import { NotFoundException } from '@nestjs/common';
import { NotesService } from './notes.service';
import { PrismaService } from '../database/prisma.service';

type PrismaMock = {
  jobApplication: {
    findFirst: jest.Mock;
  };
  applicationNote: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

function createPrismaMock(): PrismaMock {
  return {
    jobApplication: {
      findFirst: jest.fn(),
    },
    applicationNote: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

const userId = 'user-1';
const applicationId = 'app-1';
const noteId = 'note-1';
const application = { id: applicationId, userId };

describe('NotesService', () => {
  let service: NotesService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new NotesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates a note after verifying application ownership', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      const dto = { content: 'Recruiter called back.' };
      const created = { id: noteId, ...dto };
      prisma.applicationNote.create.mockResolvedValue(created);

      const result = await service.create(userId, applicationId, dto);

      expect(prisma.jobApplication.findFirst).toHaveBeenCalledWith({
        where: { id: applicationId, userId },
      });
      expect(prisma.applicationNote.create).toHaveBeenCalledWith({
        data: { content: dto.content, applicationId },
      });
      expect(result).toBe(created);
    });

    it('throws NotFoundException when the application is not owned by the user', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(
        service.create(userId, applicationId, { content: 'Note' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.applicationNote.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns notes ordered by createdAt desc after verifying ownership', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      const notes = [{ id: noteId }];
      prisma.applicationNote.findMany.mockResolvedValue(notes);

      const result = await service.findAll(userId, applicationId);

      expect(prisma.applicationNote.findMany).toHaveBeenCalledWith({
        where: { applicationId },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toBe(notes);
    });

    it('throws NotFoundException when the application is not owned by the user', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(service.findAll(userId, applicationId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.applicationNote.findMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates the note after verifying it belongs to the application', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.applicationNote.findFirst.mockResolvedValue({ id: noteId });
      const dto = { content: 'Updated note' };
      const updated = { id: noteId, ...dto };
      prisma.applicationNote.update.mockResolvedValue(updated);

      const result = await service.update(userId, applicationId, noteId, dto);

      expect(prisma.applicationNote.update).toHaveBeenCalledWith({
        where: { id: noteId },
        data: dto,
      });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when the application is not owned by the user', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(
        service.update(userId, applicationId, noteId, { content: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.applicationNote.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the note does not belong to the application', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.applicationNote.findFirst.mockResolvedValue(null);

      await expect(
        service.update(userId, applicationId, noteId, { content: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.applicationNote.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the note after verifying it belongs to the application', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.applicationNote.findFirst.mockResolvedValue({ id: noteId });
      prisma.applicationNote.delete.mockResolvedValue({ id: noteId });

      const result = await service.remove(userId, applicationId, noteId);

      expect(prisma.applicationNote.delete).toHaveBeenCalledWith({
        where: { id: noteId },
      });
      expect(result).toEqual({ id: noteId });
    });

    it('throws NotFoundException when the application is not owned by the user', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(userId, applicationId, noteId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.applicationNote.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the note does not belong to the application', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.applicationNote.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(userId, applicationId, noteId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.applicationNote.delete).not.toHaveBeenCalled();
    });
  });
});
