import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmailSyncService } from './email-sync.service';
import { PrismaService } from '../database/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { GmailOAuthClient } from './gmail/gmail-oauth.client';
import { GmailApiClient } from './gmail/gmail-api.client';
import { ApplicationStatus } from '../generated/prisma/enums';
import { encryptToken } from './encryption';

type PrismaMock = {
  gmailConnection: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  processedEmail: {
    findMany: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  jobApplication: {
    findMany: jest.Mock;
  };
};

function createPrismaMock(): PrismaMock {
  return {
    gmailConnection: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn(), delete: jest.fn() },
    processedEmail: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    jobApplication: { findMany: jest.fn() },
  };
}

function toBase64Url(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

function gmailMessageFixture(id: string, subject: string, bodyText: string, from = 'careers@acmerobotics.com') {
  return {
    id,
    threadId: `thread-${id}`,
    internalDate: '1735689600000',
    payload: {
      headers: [
        { name: 'Subject', value: subject },
        { name: 'From', value: from },
      ],
      mimeType: 'text/plain',
      body: { data: toBase64Url(bodyText) },
    },
  };
}

const userId = 'user-1';

describe('EmailSyncService', () => {
  let service: EmailSyncService;
  let prisma: PrismaMock;
  let applicationsService: { create: jest.Mock; updateStatus: jest.Mock };
  let oauthClient: { buildAuthUrl: jest.Mock; exchangeCode: jest.Mock; refreshAccessToken: jest.Mock; fetchConnectedEmail: jest.Mock; revoke: jest.Mock };
  let gmailApi: { listMessageIds: jest.Mock; getMessage: jest.Mock };

  beforeEach(() => {
    process.env.EMAIL_SYNC_ENCRYPTION_KEY = 'test-encryption-key-do-not-use-in-prod';

    prisma = createPrismaMock();
    applicationsService = { create: jest.fn(), updateStatus: jest.fn() };
    oauthClient = {
      buildAuthUrl: jest.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth?mock=1'),
      exchangeCode: jest.fn(),
      refreshAccessToken: jest.fn(),
      fetchConnectedEmail: jest.fn(),
      revoke: jest.fn(),
    };
    gmailApi = { listMessageIds: jest.fn(), getMessage: jest.fn() };

    service = new EmailSyncService(
      prisma as unknown as PrismaService,
      applicationsService as unknown as ApplicationsService,
      oauthClient as unknown as GmailOAuthClient,
      gmailApi as unknown as GmailApiClient,
    );
  });

  describe('getAuthUrl', () => {
    it('returns the URL built by the OAuth client', () => {
      expect(service.getAuthUrl()).toEqual({ url: 'https://accounts.google.com/o/oauth2/v2/auth?mock=1' });
    });
  });

  describe('getStatus', () => {
    it('reports disconnected when no connection row exists', async () => {
      prisma.gmailConnection.findUnique.mockResolvedValue(null);
      await expect(service.getStatus(userId)).resolves.toEqual({
        connected: false,
        email: null,
        lastSyncedAt: null,
      });
    });

    it('reports connected with the stored email and last sync time', async () => {
      const lastSyncedAt = new Date('2026-08-20T00:00:00.000Z');
      prisma.gmailConnection.findUnique.mockResolvedValue({ email: 'jordan@gmail.com', lastSyncedAt });
      await expect(service.getStatus(userId)).resolves.toEqual({
        connected: true,
        email: 'jordan@gmail.com',
        lastSyncedAt,
      });
    });
  });

  describe('exchangeCode', () => {
    it('creates a new connection from a fresh OAuth code', async () => {
      oauthClient.exchangeCode.mockResolvedValue({
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        expires_in: 3600,
        scope: 'gmail.readonly',
        token_type: 'Bearer',
      });
      oauthClient.fetchConnectedEmail.mockResolvedValue('jordan@gmail.com');
      prisma.gmailConnection.findUnique.mockResolvedValue(null);
      prisma.gmailConnection.upsert.mockResolvedValue({});

      const result = await service.exchangeCode(userId, 'auth-code');

      expect(result).toEqual({ connected: true, email: 'jordan@gmail.com' });
      expect(prisma.gmailConnection.upsert).toHaveBeenCalledTimes(1);
      const call = prisma.gmailConnection.upsert.mock.calls[0][0];
      expect(call.create.email).toBe('jordan@gmail.com');
      expect(call.create.refreshTokenEncrypted).not.toBe('refresh-1'); // stored encrypted, not raw
    });

    it('keeps the existing refresh token when Google omits one on re-consent', async () => {
      oauthClient.exchangeCode.mockResolvedValue({
        access_token: 'access-2',
        expires_in: 3600,
        scope: 'gmail.readonly',
        token_type: 'Bearer',
      });
      oauthClient.fetchConnectedEmail.mockResolvedValue('jordan@gmail.com');
      const existingEncrypted = encryptToken('old-refresh-token');
      prisma.gmailConnection.findUnique.mockResolvedValue({ refreshTokenEncrypted: existingEncrypted });
      prisma.gmailConnection.upsert.mockResolvedValue({});

      await service.exchangeCode(userId, 'auth-code');

      const call = prisma.gmailConnection.upsert.mock.calls[0][0];
      expect(call.update.refreshTokenEncrypted).toBe(existingEncrypted);
    });

    it('throws when there is no refresh token at all (fresh connection, none returned)', async () => {
      oauthClient.exchangeCode.mockResolvedValue({
        access_token: 'access-3',
        expires_in: 3600,
        scope: 'gmail.readonly',
        token_type: 'Bearer',
      });
      prisma.gmailConnection.findUnique.mockResolvedValue(null);

      await expect(service.exchangeCode(userId, 'auth-code')).rejects.toThrow(BadRequestException);
    });
  });

  describe('disconnect', () => {
    it('revokes the refresh token and deletes the connection', async () => {
      const refreshTokenEncrypted = encryptToken('refresh-token');
      prisma.gmailConnection.findUnique.mockResolvedValue({ refreshTokenEncrypted });
      prisma.gmailConnection.delete.mockResolvedValue({});

      await expect(service.disconnect(userId)).resolves.toEqual({ disconnected: true });
      expect(oauthClient.revoke).toHaveBeenCalledWith('refresh-token');
      expect(prisma.gmailConnection.delete).toHaveBeenCalledWith({ where: { userId } });
    });

    it('is a no-op when there is nothing connected', async () => {
      prisma.gmailConnection.findUnique.mockResolvedValue(null);
      await expect(service.disconnect(userId)).resolves.toEqual({ disconnected: true });
      expect(prisma.gmailConnection.delete).not.toHaveBeenCalled();
    });
  });

  describe('sync', () => {
    function connectedWith(overrides: Record<string, unknown> = {}) {
      prisma.gmailConnection.findUnique.mockResolvedValue({
        accessTokenEncrypted: encryptToken('valid-access-token'),
        refreshTokenEncrypted: encryptToken('refresh-token'),
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        ...overrides,
      });
    }

    it('refreshes an expired access token before listing messages', async () => {
      connectedWith({ tokenExpiresAt: new Date(Date.now() - 1000) });
      oauthClient.refreshAccessToken.mockResolvedValue({
        access_token: 'new-access-token',
        expires_in: 3600,
        scope: 'gmail.readonly',
        token_type: 'Bearer',
      });
      prisma.gmailConnection.update.mockResolvedValue({});
      gmailApi.listMessageIds.mockResolvedValue([]);
      prisma.processedEmail.findMany.mockResolvedValue([]);
      prisma.jobApplication.findMany.mockResolvedValue([]);

      await service.sync(userId);

      expect(oauthClient.refreshAccessToken).toHaveBeenCalledWith('refresh-token');
      expect(gmailApi.listMessageIds).toHaveBeenCalledWith('new-access-token', expect.any(Object));
    });

    it('throws NotFoundException when Gmail is not connected', async () => {
      prisma.gmailConnection.findUnique.mockResolvedValue(null);
      await expect(service.sync(userId)).rejects.toThrow(NotFoundException);
    });

    it('skips messages already recorded in processed_emails (dedup)', async () => {
      connectedWith();
      gmailApi.listMessageIds.mockResolvedValue([{ id: 'msg-1', threadId: 't-1' }]);
      prisma.processedEmail.findMany.mockResolvedValue([{ gmailMessageId: 'msg-1' }]);
      prisma.jobApplication.findMany.mockResolvedValue([]);

      const result = await service.sync(userId);

      expect(gmailApi.getMessage).not.toHaveBeenCalled();
      expect(result).toEqual({ scanned: 1, newlyProcessed: 0, suggestionsCreated: 0, autoDismissed: 0 });
    });

    it('auto-dismisses an unrelated email without creating a review-queue entry', async () => {
      connectedWith();
      gmailApi.listMessageIds.mockResolvedValue([{ id: 'msg-1', threadId: 't-1' }]);
      prisma.processedEmail.findMany.mockResolvedValue([]);
      prisma.jobApplication.findMany.mockResolvedValue([]);
      gmailApi.getMessage.mockResolvedValue(
        gmailMessageFixture('msg-1', 'Your receipt', 'Thanks for your order! Total: $4.50.', 'receipts@shop.com'),
      );
      prisma.processedEmail.create.mockResolvedValue({});
      prisma.gmailConnection.update.mockResolvedValue({});

      const result = await service.sync(userId);

      expect(result.autoDismissed).toBe(1);
      expect(result.suggestionsCreated).toBe(0);
      expect(prisma.processedEmail.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'DISMISSED', detectedType: 'OTHER' }) }),
      );
    });

    it('creates a CREATE_APPLICATION suggestion for a new application-received email', async () => {
      connectedWith();
      gmailApi.listMessageIds.mockResolvedValue([{ id: 'msg-1', threadId: 't-1' }]);
      prisma.processedEmail.findMany.mockResolvedValue([]);
      prisma.jobApplication.findMany.mockResolvedValue([]);
      gmailApi.getMessage.mockResolvedValue(
        gmailMessageFixture(
          'msg-1',
          'Your application to Acme Robotics has been received',
          'Thank you for applying to the Senior Backend Engineer position at Acme Robotics. We have received your application.',
        ),
      );
      prisma.processedEmail.create.mockResolvedValue({});
      prisma.gmailConnection.update.mockResolvedValue({});

      const result = await service.sync(userId);

      expect(result.suggestionsCreated).toBe(1);
      expect(prisma.processedEmail.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            suggestedAction: 'CREATE_APPLICATION',
            extractedCompany: 'Acme Robotics',
            extractedPosition: 'Senior Backend Engineer',
            status: 'PENDING',
          }),
        }),
      );
      expect(prisma.gmailConnection.update).toHaveBeenCalledWith({
        where: { userId },
        data: { lastSyncedAt: expect.any(Date) },
      });
    });

    it('creates an UPDATE_STATUS suggestion matched to an existing application', async () => {
      connectedWith();
      gmailApi.listMessageIds.mockResolvedValue([{ id: 'msg-1', threadId: 't-1' }]);
      prisma.processedEmail.findMany.mockResolvedValue([]);
      prisma.jobApplication.findMany.mockResolvedValue([
        { id: 'app-1', company: 'Acme Robotics', position: 'Senior Backend Engineer', status: ApplicationStatus.APPLIED },
      ]);
      gmailApi.getMessage.mockResolvedValue(
        gmailMessageFixture(
          'msg-1',
          'Interview invitation: Senior Backend Engineer at Acme Robotics',
          'We would like to invite you to an interview for the Senior Backend Engineer position at Acme Robotics.',
        ),
      );
      prisma.processedEmail.create.mockResolvedValue({});
      prisma.gmailConnection.update.mockResolvedValue({});

      await service.sync(userId);

      expect(prisma.processedEmail.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ suggestedAction: 'UPDATE_STATUS', matchedApplicationId: 'app-1' }),
        }),
      );
    });
  });

  describe('confirmSuggestion', () => {
    it('throws NotFoundException when the suggestion does not belong to the user', async () => {
      prisma.processedEmail.findFirst.mockResolvedValue(null);
      await expect(service.confirmSuggestion(userId, 'row-1', {})).rejects.toThrow(NotFoundException);
    });

    it('throws when the suggestion was already reviewed', async () => {
      prisma.processedEmail.findFirst.mockResolvedValue({ id: 'row-1', status: 'CONFIRMED' });
      await expect(service.confirmSuggestion(userId, 'row-1', {})).rejects.toThrow(BadRequestException);
    });

    it('throws when the suggested action is NONE', async () => {
      prisma.processedEmail.findFirst.mockResolvedValue({ id: 'row-1', status: 'PENDING', suggestedAction: 'NONE' });
      await expect(service.confirmSuggestion(userId, 'row-1', {})).rejects.toThrow(BadRequestException);
    });

    it('creates a new application for a CREATE_APPLICATION suggestion, allowing field overrides', async () => {
      prisma.processedEmail.findFirst.mockResolvedValue({
        id: 'row-1',
        status: 'PENDING',
        suggestedAction: 'CREATE_APPLICATION',
        extractedCompany: 'Acme Robotics',
        extractedPosition: 'Senior Backend Engineer',
        matchedApplicationId: null,
      });
      applicationsService.create.mockResolvedValue({ id: 'new-app-1' });
      prisma.processedEmail.update.mockResolvedValue({});

      await service.confirmSuggestion(userId, 'row-1', { company: 'Acme Robotics Corrected' });

      expect(applicationsService.create).toHaveBeenCalledWith(userId, {
        company: 'Acme Robotics Corrected',
        position: 'Senior Backend Engineer',
        status: ApplicationStatus.APPLIED,
      });
      expect(prisma.processedEmail.update).toHaveBeenCalledWith({
        where: { id: 'row-1' },
        data: { status: 'CONFIRMED', matchedApplicationId: 'new-app-1', reviewedAt: expect.any(Date) },
      });
    });

    it('throws when confirming a CREATE_APPLICATION suggestion with no company/position available', async () => {
      prisma.processedEmail.findFirst.mockResolvedValue({
        id: 'row-1',
        status: 'PENDING',
        suggestedAction: 'CREATE_APPLICATION',
        extractedCompany: null,
        extractedPosition: null,
      });

      await expect(service.confirmSuggestion(userId, 'row-1', {})).rejects.toThrow(BadRequestException);
      expect(applicationsService.create).not.toHaveBeenCalled();
    });

    it('updates the matched application status for an UPDATE_STATUS suggestion', async () => {
      prisma.processedEmail.findFirst.mockResolvedValue({
        id: 'row-1',
        status: 'PENDING',
        suggestedAction: 'UPDATE_STATUS',
        detectedType: 'INTERVIEW',
        matchedApplicationId: 'app-1',
      });
      applicationsService.updateStatus.mockResolvedValue({});
      prisma.processedEmail.update.mockResolvedValue({});

      await service.confirmSuggestion(userId, 'row-1', {});

      expect(applicationsService.updateStatus).toHaveBeenCalledWith(userId, 'app-1', ApplicationStatus.INTERVIEW);
    });

    it('propagates the applications service error and leaves the suggestion PENDING on an invalid transition', async () => {
      prisma.processedEmail.findFirst.mockResolvedValue({
        id: 'row-1',
        status: 'PENDING',
        suggestedAction: 'UPDATE_STATUS',
        detectedType: 'ASSESSMENT',
        matchedApplicationId: 'app-1',
      });
      applicationsService.updateStatus.mockRejectedValue(new BadRequestException('Application status cannot move backwards'));

      await expect(service.confirmSuggestion(userId, 'row-1', {})).rejects.toThrow(BadRequestException);
      expect(prisma.processedEmail.update).not.toHaveBeenCalled();
    });
  });

  describe('dismissSuggestion', () => {
    it('marks a pending suggestion dismissed', async () => {
      prisma.processedEmail.findFirst.mockResolvedValue({ id: 'row-1', status: 'PENDING' });
      prisma.processedEmail.update.mockResolvedValue({});

      await service.dismissSuggestion(userId, 'row-1');

      expect(prisma.processedEmail.update).toHaveBeenCalledWith({
        where: { id: 'row-1' },
        data: { status: 'DISMISSED', reviewedAt: expect.any(Date) },
      });
    });

    it('throws NotFoundException for a suggestion that does not belong to the user', async () => {
      prisma.processedEmail.findFirst.mockResolvedValue(null);
      await expect(service.dismissSuggestion(userId, 'row-1')).rejects.toThrow(NotFoundException);
    });

    it('throws when the suggestion was already reviewed', async () => {
      prisma.processedEmail.findFirst.mockResolvedValue({ id: 'row-1', status: 'DISMISSED' });
      await expect(service.dismissSuggestion(userId, 'row-1')).rejects.toThrow(BadRequestException);
    });
  });
});
