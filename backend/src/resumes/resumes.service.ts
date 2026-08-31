import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { PrismaService } from '../database/prisma.service';
import { ApplicationStatus } from '../generated/prisma/enums';

/** Statuses that mean the application reached (or moved past) a live interview. */
const INTERVIEW_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFER,
];

type ApplicationOutcome = {
  status: ApplicationStatus;
  history: { toStatus: ApplicationStatus }[];
};

/** Applications only move forward, so a current status of INTERVIEW/OFFER implies
 * an interview happened — but a later REJECTED overwrites that, so the status
 * history is also checked to keep the count honest for rejected-after-interview. */
function reachedInterview(app: ApplicationOutcome): boolean {
  return (
    INTERVIEW_STATUSES.includes(app.status) ||
    app.history.some((h) => INTERVIEW_STATUSES.includes(h.toStatus))
  );
}

function reachedOffer(app: ApplicationOutcome): boolean {
  return (
    app.status === ApplicationStatus.OFFER ||
    app.history.some((h) => h.toStatus === ApplicationStatus.OFFER)
  );
}

@Injectable()
export class ResumesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, name: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Resume file is required');
    }

    // The first resume a user uploads becomes their default automatically, so
    // resume assignment always has something pre-selected once one exists.
    const existingCount = await this.prisma.resume.count({ where: { userId } });

    return this.prisma.resume.create({
      data: {
        name,
        originalName: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        filePath: file.path,
        isDefault: existingCount === 0,
        userId,
      },
    });
  }

  /** Returns each resume enriched with how many applications use it and how far
   * those applications have progressed (applications / interviews / offers).
   * Default resume first, then newest. */
  async findAll(userId: string) {
    const resumes = await this.prisma.resume.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      include: {
        applications: {
          select: {
            status: true,
            history: { select: { toStatus: true } },
          },
        },
      },
    });

    return resumes.map(({ applications, ...resume }) => ({
      ...resume,
      applicationCount: applications.length,
      metrics: {
        applications: applications.length,
        interviews: applications.filter(reachedInterview).length,
        offers: applications.filter(reachedOffer).length,
      },
    }));
  }

  async findOne(userId: string, id: string) {
    const resume = await this.prisma.resume.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    return resume;
  }

  /** Rename the label shown on the resume card; the stored file is untouched. */
  async rename(userId: string, id: string, name: string) {
    await this.findOne(userId, id);

    return this.prisma.resume.update({
      where: { id },
      data: { name },
    });
  }

  /** Marks one resume as the user's default, clearing the flag on the rest in
   * the same transaction so "exactly one default" always holds. */
  async setDefault(userId: string, id: string) {
    await this.findOne(userId, id);

    const [, updated] = await this.prisma.$transaction([
      this.prisma.resume.updateMany({
        where: { userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      }),
      this.prisma.resume.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return updated;
  }

  async remove(userId: string, id: string) {
    const resume = await this.findOne(userId, id);

    await this.prisma.resume.delete({
      where: {
        id,
      },
    });

    // Deleting the default leaves the user with no default — promote the most
    // recent remaining resume so assignment keeps a sensible pre-selection.
    if (resume.isDefault) {
      const next = await this.prisma.resume.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (next) {
        await this.prisma.resume.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    try {
      await unlink(resume.filePath);
    } catch {
      // File may already be missing.
    }

    return {
      message: 'Resume deleted successfully',
    };
  }
}
