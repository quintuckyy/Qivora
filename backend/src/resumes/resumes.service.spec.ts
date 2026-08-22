import { BadRequestException, NotFoundException } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { ResumesService } from './resumes.service';
import { PrismaService } from '../database/prisma.service';

jest.mock('node:fs/promises', () => ({
  unlink: jest.fn(),
}));

const mockedUnlink = unlink as jest.Mock;

type PrismaMock = {
  resume: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    delete: jest.Mock;
  };
};

function createPrismaMock(): PrismaMock {
  return {
    resume: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };
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
          userId,
        },
      });
      expect(result).toBe(created);
    });
  });

  describe('findAll', () => {
    it('returns resumes for the user ordered by createdAt desc', async () => {
      const resumes = [buildResume()];
      prisma.resume.findMany.mockResolvedValue(resumes);

      const result = await service.findAll(userId);

      expect(prisma.resume.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toBe(resumes);
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
