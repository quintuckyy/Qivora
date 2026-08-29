import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { EmailSyncService } from './email-sync.service';

// Within the 10-15 minute window the feature calls for, and comfortably
// longer than a single sync run takes — ticks aren't expected to overlap
// the same user in practice, and EmailSyncService's per-user lock covers it
// even if one ever runs long.
export const AUTO_SYNC_INTERVAL_MS = 12 * 60 * 1000;

/** Runs the same sync EmailSyncService.sync() does, but on a timer instead
 * of the "Sync Gmail" button, for every user with Gmail connected. Users are
 * processed one at a time (not in parallel) — deliberately simple, and it
 * keeps the automatic job from bursting many concurrent Gmail API calls at
 * once. */
@Injectable()
export class GmailAutoSyncScheduler {
  private readonly logger = new Logger(GmailAutoSyncScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSyncService: EmailSyncService,
  ) {}

  @Interval(AUTO_SYNC_INTERVAL_MS)
  async handleInterval(): Promise<void> {
    await this.runAutoSyncForAllUsers();
  }

  /** Split out from the @Interval hook so tests can trigger a single pass
   * directly instead of waiting on the real timer. */
  async runAutoSyncForAllUsers(): Promise<void> {
    // needsReconnect: false — a connection whose refresh token is already
    // known to be revoked/expired would just fail the same way again; skip
    // it until the user reconnects instead of hitting Google on every tick.
    const connections = await this.prisma.gmailConnection.findMany({
      where: { needsReconnect: false },
      select: { userId: true },
    });

    for (const { userId } of connections) {
      try {
        const result = await this.emailSyncService.autoSyncUser(userId);
        if (result.status === 'synced' && result.suggestionsCreated > 0) {
          this.logger.log(
            `Automatic Gmail sync for user ${userId} found ${result.suggestionsCreated} new suggestion(s).`,
          );
        } else if (result.status === 'reauth_required') {
          this.logger.warn(`Automatic Gmail sync for user ${userId} needs reconnect — Gmail access was revoked.`);
        }
      } catch (error) {
        // One user's failure (network hiccup, an unexpected Gmail API error)
        // must never stop the rest of the batch from syncing.
        this.logger.warn(`Automatic Gmail sync failed for user ${userId}: ${(error as Error).message}`);
      }
    }
  }
}
