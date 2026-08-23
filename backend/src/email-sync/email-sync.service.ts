import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { ApplicationStatus } from '../generated/prisma/enums';
import type { DetectedEmailType, SuggestionStatus } from '../generated/prisma/enums';
import { GmailOAuthClient } from './gmail/gmail-oauth.client';
import { GmailApiClient } from './gmail/gmail-api.client';
import { parseGmailMessage } from './gmail/gmail-message.parser';
import { classifyEmail } from './classification/email-classifier';
import { matchApplication, statusForDetectedType } from './matching/application-matcher';
import { encryptToken, decryptToken } from './encryption';
import { ConfirmSuggestionDto } from './dto/confirm-suggestion.dto';

// "Safe MVP" bounds from the spec: manual trigger only, recent mail only,
// capped per run so a single click can never scan an entire mailbox.
const SYNC_WINDOW_DAYS = 30;
const MAX_MESSAGES_PER_SYNC = 40;

@Injectable()
export class EmailSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applicationsService: ApplicationsService,
    private readonly oauthClient: GmailOAuthClient,
    private readonly gmailApi: GmailApiClient,
  ) {}

  getAuthUrl() {
    return { url: this.oauthClient.buildAuthUrl() };
  }

  async getStatus(userId: string) {
    const connection = await this.prisma.gmailConnection.findUnique({ where: { userId } });
    return {
      connected: connection !== null,
      email: connection?.email ?? null,
      lastSyncedAt: connection?.lastSyncedAt ?? null,
    };
  }

  async exchangeCode(userId: string, code: string) {
    const tokens = await this.oauthClient.exchangeCode(code);
    const existing = await this.prisma.gmailConnection.findUnique({ where: { userId } });

    // Google only returns a refresh_token on the consent that grants it —
    // we always request prompt=consent so this should be populated, but
    // fall back to keeping whatever was already stored rather than wiping it.
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : existing?.refreshTokenEncrypted;

    if (!refreshTokenEncrypted) {
      throw new BadRequestException(
        'Google did not grant offline access. Please try connecting Gmail again.',
      );
    }

    const email = await this.oauthClient.fetchConnectedEmail(tokens.access_token);

    await this.prisma.gmailConnection.upsert({
      where: { userId },
      create: {
        userId,
        email,
        accessTokenEncrypted: encryptToken(tokens.access_token),
        refreshTokenEncrypted,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
      },
      update: {
        email,
        accessTokenEncrypted: encryptToken(tokens.access_token),
        refreshTokenEncrypted,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope,
      },
    });

    return { connected: true, email };
  }

  async disconnect(userId: string) {
    const connection = await this.prisma.gmailConnection.findUnique({ where: { userId } });
    if (!connection) {
      return { disconnected: true };
    }

    await this.oauthClient.revoke(decryptToken(connection.refreshTokenEncrypted));
    await this.prisma.gmailConnection.delete({ where: { userId } });

    return { disconnected: true };
  }

  private async getValidAccessToken(userId: string): Promise<string> {
    const connection = await this.prisma.gmailConnection.findUnique({ where: { userId } });
    if (!connection) {
      throw new NotFoundException('Gmail is not connected.');
    }

    const stillValid = connection.tokenExpiresAt.getTime() > Date.now() + 60_000;
    if (stillValid) {
      return decryptToken(connection.accessTokenEncrypted);
    }

    const refreshed = await this.oauthClient.refreshAccessToken(decryptToken(connection.refreshTokenEncrypted));

    await this.prisma.gmailConnection.update({
      where: { userId },
      data: {
        accessTokenEncrypted: encryptToken(refreshed.access_token),
        tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        // A refresh grant doesn't usually return a new refresh_token; only
        // overwrite the stored one on the rare occasion Google rotates it.
        ...(refreshed.refresh_token ? { refreshTokenEncrypted: encryptToken(refreshed.refresh_token) } : {}),
      },
    });

    return refreshed.access_token;
  }

  private buildSearchQuery(): string {
    const keywords = [
      'application',
      'applying',
      'applicant',
      'interview',
      'assessment',
      'candidacy',
      'recruiter',
      'hiring',
      '"job offer"',
      '"thank you for applying"',
      '"thank you for your interest"',
    ];
    return `newer_than:${SYNC_WINDOW_DAYS}d -in:chats -in:spam -in:trash -category:promotions -category:social (${keywords.join(' OR ')})`;
  }

  /** The manual "Sync Gmail" button. Scans recent candidate messages (bounded
   * by SYNC_WINDOW_DAYS / MAX_MESSAGES_PER_SYNC), skips anything already in
   * processed_emails (the dedup ledger), classifies and matches whatever's
   * left, and stores a review-queue row for every job-related email found —
   * nothing is created or changed on an application until the user confirms. */
  async sync(userId: string) {
    const accessToken = await this.getValidAccessToken(userId);

    const candidates = await this.gmailApi.listMessageIds(accessToken, {
      query: this.buildSearchQuery(),
      maxResults: MAX_MESSAGES_PER_SYNC,
    });

    const alreadyProcessed = await this.prisma.processedEmail.findMany({
      where: { userId, gmailMessageId: { in: candidates.map((c) => c.id) } },
      select: { gmailMessageId: true },
    });
    const processedIds = new Set(alreadyProcessed.map((p) => p.gmailMessageId));
    const newCandidates = candidates.filter((c) => !processedIds.has(c.id));

    const existingApplications = await this.prisma.jobApplication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, company: true, position: true, status: true },
    });

    let suggestionsCreated = 0;
    let autoDismissed = 0;

    for (const candidate of newCandidates) {
      const raw = await this.gmailApi.getMessage(accessToken, candidate.id);
      const parsed = parseGmailMessage(raw);
      const detected = classifyEmail({ subject: parsed.subject, bodyText: parsed.bodyText, from: parsed.from });

      if (detected.type === 'OTHER') {
        await this.prisma.processedEmail.create({
          data: {
            userId,
            gmailMessageId: candidate.id,
            gmailThreadId: candidate.threadId,
            subject: parsed.subject || null,
            fromAddress: parsed.from || null,
            receivedAt: parsed.receivedAt,
            detectedType: 'OTHER',
            confidence: detected.confidence,
            suggestedAction: 'NONE',
            status: 'DISMISSED',
            reviewedAt: new Date(),
          },
        });
        autoDismissed++;
        continue;
      }

      const match = matchApplication(
        { type: detected.type, company: detected.company, position: detected.position },
        existingApplications,
      );

      await this.prisma.processedEmail.create({
        data: {
          userId,
          gmailMessageId: candidate.id,
          gmailThreadId: candidate.threadId,
          subject: parsed.subject || null,
          fromAddress: parsed.from || null,
          receivedAt: parsed.receivedAt,
          detectedType: detected.type,
          confidence: detected.confidence,
          extractedCompany: detected.company,
          extractedPosition: detected.position,
          extractedSource: detected.source,
          suggestedAction: match.suggestedAction,
          matchedApplicationId: match.matchedApplicationId,
          status: 'PENDING',
        },
      });
      suggestionsCreated++;
    }

    await this.prisma.gmailConnection.update({
      where: { userId },
      data: { lastSyncedAt: new Date() },
    });

    return {
      scanned: candidates.length,
      newlyProcessed: newCandidates.length,
      suggestionsCreated,
      autoDismissed,
    };
  }

  async listSuggestions(userId: string) {
    return this.prisma.processedEmail.findMany({
      where: { userId, status: 'PENDING' as SuggestionStatus },
      orderBy: { createdAt: 'desc' },
      include: {
        matchedApplication: {
          select: { id: true, company: true, position: true, status: true },
        },
      },
    });
  }

  async confirmSuggestion(userId: string, id: string, dto: ConfirmSuggestionDto) {
    const row = await this.prisma.processedEmail.findFirst({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException('Suggestion not found');
    }
    if (row.status !== 'PENDING') {
      throw new BadRequestException(`This suggestion was already ${row.status.toLowerCase()}.`);
    }
    if (row.suggestedAction === 'NONE') {
      throw new BadRequestException('This suggestion has no action to confirm — dismiss it instead.');
    }

    let resultApplicationId = row.matchedApplicationId;

    if (row.suggestedAction === 'CREATE_APPLICATION') {
      const company = dto.company?.trim() || row.extractedCompany;
      const position = dto.position?.trim() || row.extractedPosition;
      if (!company || !position) {
        throw new BadRequestException('Company and position are required to create an application.');
      }

      const created = await this.applicationsService.create(userId, {
        company,
        position,
        status: ApplicationStatus.APPLIED,
      });
      resultApplicationId = created.id;
    } else if (row.suggestedAction === 'UPDATE_STATUS') {
      if (!row.matchedApplicationId) {
        throw new BadRequestException('No matched application to update.');
      }
      const targetStatus = statusForDetectedType(row.detectedType as Exclude<DetectedEmailType, 'OTHER'>);
      await this.applicationsService.updateStatus(userId, row.matchedApplicationId, targetStatus);
    }

    return this.prisma.processedEmail.update({
      where: { id },
      data: { status: 'CONFIRMED', matchedApplicationId: resultApplicationId, reviewedAt: new Date() },
    });
  }

  async dismissSuggestion(userId: string, id: string) {
    const row = await this.prisma.processedEmail.findFirst({ where: { id, userId } });
    if (!row) {
      throw new NotFoundException('Suggestion not found');
    }
    if (row.status !== 'PENDING') {
      throw new BadRequestException(`This suggestion was already ${row.status.toLowerCase()}.`);
    }

    return this.prisma.processedEmail.update({
      where: { id },
      data: { status: 'DISMISSED', reviewedAt: new Date() },
    });
  }
}
