import { unlink } from 'node:fs/promises';
import { PrismaService } from '../../src/database/prisma.service';

/**
 * Deleting all users cascades (at the DB level, via onDelete: Cascade) through
 * job_applications, application_history, interviews, application_notes, and resumes,
 * so a single deleteMany clears every table between tests. Resume file uploads live
 * on disk outside that cascade, so their files are removed first.
 */
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  const resumes = await prisma.resume.findMany({ select: { filePath: true } });

  await Promise.all(
    resumes.map((resume) => unlink(resume.filePath).catch(() => undefined)),
  );

  await prisma.user.deleteMany();
}
