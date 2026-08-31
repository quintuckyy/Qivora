import { BadRequestException, NotFoundException } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { ResumesService } from './resumes.service';
import { PrismaService } from '../database/prisma.service';
import { ApplicationStatus } from '../generated/prisma/enums';

jest.mock('node:fs/promises', () => ({
  unlink: jest.fn(),
}));

const mockedUnlink = unlink as jest.Mock;

type PrismaMock = {
  resume: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  $transaction: jest.Mock;
};

function createPrismaMock(): PrismaMock {
  const prisma: PrismaMock = {
    resume: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation((arg: unknown) => {
    if (typeof arg === 'function') {
      return arg(prisma);
    }

    return Promise.all(arg as Promise<unknown>[]);
  });

  return prisma;
}

const userId = 'user-1';
const resumeId = 'resume-1';

const buildFile = (overrides: Partial<Express.Multer.File> = {}) =>
  ({
    originalname: 'resume.pdf',
    filename: 'stored-resume.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    path: './uploads/resumes/stored-resume.pdf',
    ...overrides,
  }) as Express.Multer.File;

const buildResume = (overrides: Record<string, unknown> = {}) => ({
  id: resumeId,
  userId,
  name: 'resume.pdf',
  originalName: 'resume.pdf',
  storedName: 'stored-resume.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  filePath: './uploads/resumes/stored-resume.pdf',
  isDefault: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('ResumesService', () => {
  let service: ResumesService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ResumesService(prisma as unknown as PrismaService);
    mockedUnlink.mockReset();
  });

  describe('create', () => {
    it('throws BadRequestException when no file is provided', async () => {
      await expect(
        service.create(userId, 'Resume', undefined as never),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.resume.create).not.toHaveBeenCalled();
    });

    it('creates a resume record from the uploaded file metadata', async () => {
      const file = buildFile();
      const created = buildResume();
      prisma.resume.count.mockResolvedValue(2);
      prisma.resume.create.mockResolvedValue(created);

      const result = await service.create(userId, 'resume.pdf', file);

      expect(prisma.resume.create).toHaveBeenCalledWith({
        data: {
          name: 'resume.pdf',
          originalName: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          filePath: file.path,
          isDefault: false,
          userId,
        },
      });
      expect(result).toBe(created);
    });

    it('marks the very first resume a user uploads as the default', async () => {
      prisma.resume.count.mockResolvedValue(0);
      prisma.resume.create.mockResolvedValue(buildResume({ isDefault: true }));

      await service.create(userId, 'resume.pdf', buildFile());

      expect(prisma.resume.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isDefault: true }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('returns resumes with usage counts and performance metrics, default first', async () => {
      prisma.resume.findMany.mockResolvedValue([
        buildResume({
          id: 'r1',
          isDefault: true,
          applications: [
            { status: ApplicationStatus.OFFER, history: [] },
            {
              status: ApplicationStatus.REJECTED,
              history: [{ toStatus: ApplicationStatus.INTERVIEW }],
            },
            { status: ApplicationStatus.APPLIED, history: [] },
          ],
        }),
        buildResume({ id: 'r2', applications: [] }),
      ]);

      const result = await service.findAll(userId);

      expect(prisma.resume.findMany).toHaveBeenCalledWith({
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

      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'r1',
          applicationCount: 3,
          metrics: { applications: 3, interviews: 2, offers: 1 },
        }),
      );
      expect(result[0]).not.toHaveProperty('applications');
      expect(result[1]).toEqual(
        expect.objectContaining({
          id: 'r2',
          applicationCount: 0,
          metrics: { applications: 0, interviews: 0, offers: 0 },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the resume when owned by the user', async () => {
      const resume = buildResume();
      prisma.resume.findFirst.mockResolvedValue(resume);

      const result = await service.findOne(userId, resumeId);

      expect(prisma.resume.findFirst).toHaveBeenCalledWith({
        where: { id: resumeId, userId },
      });
      expect(result).toBe(resume);
    });

    it('throws NotFoundException when the resume does not exist or is not owned', async () => {
      prisma.resume.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, resumeId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rename', () => {
    it('updates the name after verifying ownership', async () => {
      prisma.resume.findFirst.mockResolvedValue(buildResume());
      const renamed = buildResume({ name: 'Backend .NET' });
      prisma.resume.update.mockResolvedValue(renamed);

      const result = await service.rename(userId, resumeId, 'Backend .NET');

      expect(prisma.resume.update).toHaveBeenCalledWith({
        where: { id: resumeId },
        data: { name: 'Backend .NET' },
      });
      expect(result).toBe(renamed);
    });

    it('throws NotFoundException and skips the update when not owned', async () => {
      prisma.resume.findFirst.mockResolvedValue(null);

      await expect(
        service.rename(userId, resumeId, 'X'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.resume.update).not.toHaveBeenCalled();
    });
  });

  describe('setDefault', () => {
    it('clears the flag on the other resumes and sets it on the target', async () => {
      prisma.resume.findFirst.mockResolvedValue(buildResume());
      prisma.resume.updateMany.mockResolvedValue({ count: 1 });
      const updated = buildResume({ isDefault: true });
      prisma.resume.update.mockResolvedValue(updated);

      const result = await service.setDefault(userId, resumeId);

      expect(prisma.resume.updateMany).toHaveBeenCalledWith({
        where: { userId, isDefault: true, id: { not: resumeId } },
        data: { isDefault: false },
      });
      expect(prisma.resume.update).toHaveBeenCalledWith({
        where: { id: resumeId },
        data: { isDefault: true },
      });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when the resume is not owned', async () => {
      prisma.resume.findFirst.mockResolvedValue(null);

      await expect(service.setDefault(userId, resumeId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.resume.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the database record and removes the file from disk', async () => {
      const resume = buildResume();
      prisma.resume.findFirst.mockResolvedValue(resume);
      prisma.resume.delete.mockResolvedValue(resume);
      mockedUnlink.mockResolvedValue(undefined);

      const result = await service.remove(userId, resumeId);

      expect(prisma.resume.delete).toHaveBeenCalledWith({
        where: { id: resumeId },
      });
      expect(mockedUnlink).toHaveBeenCalledWith(resume.filePath);
      expect(result).toEqual({ message: 'Resume deleted successfully' });
    });

    it('promotes the newest remaining resume when the deleted one was default', async () => {
      prisma.resume.findFirst
        .mockResolvedValueOnce(buildResume({ isDefault: true }))
        .mockResolvedValueOnce(buildResume({ id: 'r2' }));
      prisma.resume.delete.mockResolvedValue(buildResume({ isDefault: true }));
      mockedUnlink.mockResolvedValue(undefined);

      await service.remove(userId, resumeId);

      expect(prisma.resume.update).toHaveBeenCalledWith({
        where: { id: 'r2' },
        data: { isDefault: true },
      });
    });

    it('still succeeds when the file is already missing from disk', async () => {
      const resume = buildResume();
      prisma.resume.findFirst.mockResolvedValue(resume);
      prisma.resume.delete.mockResolvedValue(resume);
      mockedUnlink.mockRejectedValue(new Error('ENOENT'));

      const result = await service.remove(userId, resumeId);

      expect(result).toEqual({ message: 'Resume deleted successfully' });
    });

    it('throws NotFoundException and skips deletion when the resume is not owned', async () => {
      prisma.resume.findFirst.mockResolvedValue(null);

      await expect(service.remove(userId, resumeId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.resume.delete).not.toHaveBeenCalled();
      expect(mockedUnlink).not.toHaveBeenCalled();
    });
  });
});
