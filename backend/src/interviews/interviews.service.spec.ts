import { NotFoundException } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { PrismaService } from '../database/prisma.service';

type PrismaMock = {
  jobApplication: {
    findFirst: jest.Mock;
  };
  interview: {
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
    interview: {
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
const interviewId = 'interview-1';
const application = { id: applicationId, userId };

describe('InterviewsService', () => {
  let service: InterviewsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new InterviewsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates an interview after verifying application ownership', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      const dto = {
        title: 'Technical Interview',
        scheduledAt: '2026-08-25T10:00:00+08:00',
        location: 'Taguig',
        meetingUrl: 'https://teams.microsoft.com/example',
        notes: 'Prepare topics',
      };
      const created = { id: interviewId, ...dto };
      prisma.interview.create.mockResolvedValue(created);

      const result = await service.create(userId, applicationId, dto);

      expect(prisma.jobApplication.findFirst).toHaveBeenCalledWith({
        where: { id: applicationId, userId },
      });
      expect(prisma.interview.create).toHaveBeenCalledWith({
        data: {
          title: dto.title,
          scheduledAt: new Date(dto.scheduledAt),
          location: dto.location,
          meetingUrl: dto.meetingUrl,
          notes: dto.notes,
          applicationId,
        },
      });
      expect(result).toBe(created);
    });

    it('throws NotFoundException when the application is not owned by the user', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(
        service.create(userId, applicationId, {
          title: 'Technical Interview',
          scheduledAt: '2026-08-25T10:00:00+08:00',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.interview.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns interviews ordered by scheduledAt after verifying ownership', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      const interviews = [{ id: interviewId }];
      prisma.interview.findMany.mockResolvedValue(interviews);

      const result = await service.findAll(userId, applicationId);

      expect(prisma.interview.findMany).toHaveBeenCalledWith({
        where: { applicationId },
        orderBy: { scheduledAt: 'asc' },
      });
      expect(result).toBe(interviews);
    });

    it('throws NotFoundException when the application is not owned by the user', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(service.findAll(userId, applicationId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.interview.findMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates the interview and converts scheduledAt when provided', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.interview.findFirst.mockResolvedValue({ id: interviewId });
      const dto = { title: 'Final Interview', scheduledAt: '2026-08-27T14:00:00+08:00' };
      const updated = { id: interviewId, ...dto };
      prisma.interview.update.mockResolvedValue(updated);

      const result = await service.update(
        userId,
        applicationId,
        interviewId,
        dto,
      );

      expect(prisma.interview.update).toHaveBeenCalledWith({
        where: { id: interviewId },
        data: {
          title: dto.title,
          scheduledAt: new Date(dto.scheduledAt),
        },
      });
      expect(result).toBe(updated);
    });

    it('updates the interview without touching scheduledAt when not provided', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.interview.findFirst.mockResolvedValue({ id: interviewId });
      const dto = { location: 'BGC, Taguig' };
      prisma.interview.update.mockResolvedValue({ id: interviewId, ...dto });

      await service.update(userId, applicationId, interviewId, dto);

      expect(prisma.interview.update).toHaveBeenCalledWith({
        where: { id: interviewId },
        data: { location: 'BGC, Taguig' },
      });
    });

    it('throws NotFoundException when the application is not owned by the user', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(
        service.update(userId, applicationId, interviewId, {}),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.interview.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the interview does not belong to the application', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.interview.findFirst.mockResolvedValue(null);

      await expect(
        service.update(userId, applicationId, interviewId, {}),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.interview.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the interview after verifying ownership', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.interview.findFirst.mockResolvedValue({ id: interviewId });
      prisma.interview.delete.mockResolvedValue({ id: interviewId });

      const result = await service.remove(userId, applicationId, interviewId);

      expect(prisma.interview.delete).toHaveBeenCalledWith({
        where: { id: interviewId },
      });
      expect(result).toEqual({ id: interviewId });
    });

    it('throws NotFoundException when the application is not owned by the user', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(userId, applicationId, interviewId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.interview.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the interview does not belong to the application', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.interview.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(userId, applicationId, interviewId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.interview.delete).not.toHaveBeenCalled();
    });
  });
});
