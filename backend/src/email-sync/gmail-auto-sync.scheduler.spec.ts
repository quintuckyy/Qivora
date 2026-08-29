import { GmailAutoSyncScheduler } from './gmail-auto-sync.scheduler';
import { PrismaService } from '../database/prisma.service';
import { EmailSyncService } from './email-sync.service';

describe('GmailAutoSyncScheduler', () => {
  let scheduler: GmailAutoSyncScheduler;
  let prisma: { gmailConnection: { findMany: jest.Mock } };
  let emailSyncService: { autoSyncUser: jest.Mock };

  beforeEach(() => {
    prisma = { gmailConnection: { findMany: jest.fn() } };
    emailSyncService = { autoSyncUser: jest.fn() };
    scheduler = new GmailAutoSyncScheduler(
      prisma as unknown as PrismaService,
      emailSyncService as unknown as EmailSyncService,
    );
  });

  it('only queries connections that do not need reconnecting', async () => {
    prisma.gmailConnection.findMany.mockResolvedValue([]);

    await scheduler.runAutoSyncForAllUsers();

    expect(prisma.gmailConnection.findMany).toHaveBeenCalledWith({
      where: { needsReconnect: false },
      select: { userId: true },
    });
  });

  it('syncs every connected user', async () => {
    prisma.gmailConnection.findMany.mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]);
    emailSyncService.autoSyncUser.mockResolvedValue({
      userId: 'user-1',
      status: 'synced',
      scanned: 0,
      newlyProcessed: 0,
      suggestionsCreated: 0,
      autoDismissed: 0,
    });

    await scheduler.runAutoSyncForAllUsers();

    expect(emailSyncService.autoSyncUser).toHaveBeenCalledTimes(2);
    expect(emailSyncService.autoSyncUser).toHaveBeenNthCalledWith(1, 'user-1');
    expect(emailSyncService.autoSyncUser).toHaveBeenNthCalledWith(2, 'user-2');
  });

  // Regression: one user's Gmail account misbehaving (a network error, a
  // freak Gmail API failure) must never stop the rest of the batch — every
  // other connected user should still get synced in the same pass.
  it('keeps syncing the remaining users when one user throws', async () => {
    prisma.gmailConnection.findMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
      { userId: 'user-3' },
    ]);
    emailSyncService.autoSyncUser.mockImplementation((userId: string) => {
      if (userId === 'user-2') {
        return Promise.reject(new Error('Gmail API is down'));
      }
      return Promise.resolve({
        userId,
        status: 'synced',
        scanned: 0,
        newlyProcessed: 0,
        suggestionsCreated: 0,
        autoDismissed: 0,
      });
    });

    await expect(scheduler.runAutoSyncForAllUsers()).resolves.toBeUndefined();

    expect(emailSyncService.autoSyncUser).toHaveBeenCalledTimes(3);
    expect(emailSyncService.autoSyncUser).toHaveBeenCalledWith('user-3');
  });

  it('does nothing when no users have Gmail connected', async () => {
    prisma.gmailConnection.findMany.mockResolvedValue([]);

    await scheduler.runAutoSyncForAllUsers();

    expect(emailSyncService.autoSyncUser).not.toHaveBeenCalled();
  });
});
