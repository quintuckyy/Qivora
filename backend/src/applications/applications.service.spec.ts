import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../database/prisma.service';
import { ApplicationStatus } from '../generated/prisma/enums';

type PrismaMock = {
  jobApplication: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  applicationHistory: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
  resume: {
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
};

function createPrismaMock(): PrismaMock {
  const prisma: PrismaMock = {
    jobApplication: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    applicationHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    resume: {
      findFirst: jest.fn(),
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
const applicationId = 'application-1';

const buildApplication = (overrides: Record<string, unknown> = {}) => ({
  id: applicationId,
  userId,
  company: 'Infor',
  position: 'Senior Software Engineer',
  status: ApplicationStatus.APPLIED,
  salaryMin: 140000,
  salaryMax: 160000,
  location: 'Taguig, Metro Manila',
  jobUrl: 'https://careers.example.com/jobs/123',
  resumeId: null,
  createdAt: new Date('2026-01-15T00:00:00.000Z'),
  updatedAt: new Date('2026-01-15T00:00:00.000Z'),
  ...overrides,
});

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ApplicationsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates a job application for the given user', async () => {
      const dto = {
        company: 'Infor',
        position: 'Senior Software Engineer',
        status: ApplicationStatus.APPLIED,
        salaryMin: 140000,
        salaryMax: 160000,
        location: 'Taguig, Metro Manila',
        jobUrl: 'https://careers.example.com/jobs/123',
      };
      const created = buildApplication();
      prisma.jobApplication.create.mockResolvedValue(created);

      const result = await service.create(userId, dto);

      expect(prisma.jobApplication.create).toHaveBeenCalledWith({
        data: {
          company: dto.company,
          position: dto.position,
          status: dto.status,
          salaryMin: dto.salaryMin,
          salaryMax: dto.salaryMax,
          location: dto.location,
          jobUrl: dto.jobUrl,
          userId,
        },
      });
      expect(result).toBe(created);
    });
  });

  describe('findOne', () => {
    it('returns the application when owned by the user', async () => {
      const application = buildApplication();
      prisma.jobApplication.findFirst.mockResolvedValue(application);

      const result = await service.findOne(userId, applicationId);

      expect(prisma.jobApplication.findFirst).toHaveBeenCalledWith({
        where: { id: applicationId, userId },
      });
      expect(result).toBe(application);
    });

    it('throws NotFoundException when the application does not exist or belongs to another user', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, applicationId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates the application after verifying ownership', async () => {
      const application = buildApplication();
      const updated = buildApplication({ company: 'Updated Co' });
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.jobApplication.update.mockResolvedValue(updated);

      const dto = { company: 'Updated Co' };
      const result = await service.update(userId, applicationId, dto);

      expect(prisma.jobApplication.findFirst).toHaveBeenCalledWith({
        where: { id: applicationId, userId },
      });
      expect(prisma.jobApplication.update).toHaveBeenCalledWith({
        where: { id: applicationId },
        data: dto,
      });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException and skips the update when the application is not owned', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(
        service.update(userId, applicationId, { company: 'X' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.jobApplication.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the application after verifying ownership', async () => {
      const application = buildApplication();
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.jobApplication.delete.mockResolvedValue(application);

      const result = await service.remove(userId, applicationId);

      expect(prisma.jobApplication.delete).toHaveBeenCalledWith({
        where: { id: applicationId },
      });
      expect(result).toBe(application);
    });

    it('throws NotFoundException and skips the delete when the application is not owned', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(service.remove(userId, applicationId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.jobApplication.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const baseQuery = {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc' as const,
    };

    it('paginates using skip/take derived from page and limit', async () => {
      prisma.jobApplication.findMany.mockResolvedValue([buildApplication()]);
      prisma.jobApplication.count.mockResolvedValue(21);

      const result = await service.findAll(userId, {
        ...baseQuery,
        page: 3,
        limit: 5,
      });

      expect(prisma.jobApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
      expect(result.meta).toEqual({
        page: 3,
        limit: 5,
        total: 21,
        totalPages: 5,
      });
    });

    it('filters by status when provided', async () => {
      prisma.jobApplication.findMany.mockResolvedValue([]);
      prisma.jobApplication.count.mockResolvedValue(0);

      await service.findAll(userId, {
        ...baseQuery,
        status: ApplicationStatus.INTERVIEW,
      });

      expect(prisma.jobApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            status: ApplicationStatus.INTERVIEW,
          }),
        }),
      );
    });

    it('applies a case-insensitive search across company, position, and location', async () => {
      prisma.jobApplication.findMany.mockResolvedValue([]);
      prisma.jobApplication.count.mockResolvedValue(0);

      await service.findAll(userId, {
        ...baseQuery,
        search: 'infor',
      });

      expect(prisma.jobApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { company: { contains: 'infor', mode: 'insensitive' } },
              { position: { contains: 'infor', mode: 'insensitive' } },
              { location: { contains: 'infor', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('sorts using the requested sortBy and sortOrder', async () => {
      prisma.jobApplication.findMany.mockResolvedValue([]);
      prisma.jobApplication.count.mockResolvedValue(0);

      await service.findAll(userId, {
        ...baseQuery,
        sortBy: 'company',
        sortOrder: 'asc',
      });

      expect(prisma.jobApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { company: 'asc' },
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('allows a forward transition and records history in the same transaction', async () => {
      const application = buildApplication({
        status: ApplicationStatus.APPLIED,
      });
      const updated = buildApplication({
        status: ApplicationStatus.ASSESSMENT,
      });
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.jobApplication.update.mockResolvedValue(updated);
      prisma.applicationHistory.create.mockResolvedValue({});

      const result = await service.updateStatus(
        userId,
        applicationId,
        ApplicationStatus.ASSESSMENT,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
      expect(prisma.jobApplication.update).toHaveBeenCalledWith({
        where: { id: applicationId },
        data: { status: ApplicationStatus.ASSESSMENT },
      });
      expect(prisma.applicationHistory.create).toHaveBeenCalledWith({
        data: {
          applicationId,
          fromStatus: ApplicationStatus.APPLIED,
          toStatus: ApplicationStatus.ASSESSMENT,
        },
      });
      expect(result).toBe(updated);
    });

    it('allows skipping directly from APPLIED to INTERVIEW', async () => {
      const application = buildApplication({
        status: ApplicationStatus.APPLIED,
      });
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.jobApplication.update.mockResolvedValue(
        buildApplication({ status: ApplicationStatus.INTERVIEW }),
      );
      prisma.applicationHistory.create.mockResolvedValue({});

      await service.updateStatus(
        userId,
        applicationId,
        ApplicationStatus.INTERVIEW,
      );

      expect(prisma.jobApplication.update).toHaveBeenCalledWith({
        where: { id: applicationId },
        data: { status: ApplicationStatus.INTERVIEW },
      });
    });

    it('allows rejecting from any non-rejected status', async () => {
      const application = buildApplication({
        status: ApplicationStatus.ASSESSMENT,
      });
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.jobApplication.update.mockResolvedValue(
        buildApplication({ status: ApplicationStatus.REJECTED }),
      );
      prisma.applicationHistory.create.mockResolvedValue({});

      await service.updateStatus(
        userId,
        applicationId,
        ApplicationStatus.REJECTED,
      );

      expect(prisma.jobApplication.update).toHaveBeenCalledWith({
        where: { id: applicationId },
        data: { status: ApplicationStatus.REJECTED },
      });
    });

    it('rejects a same-status transition', async () => {
      const application = buildApplication({
        status: ApplicationStatus.APPLIED,
      });
      prisma.jobApplication.findFirst.mockResolvedValue(application);

      await expect(
        service.updateStatus(userId, applicationId, ApplicationStatus.APPLIED),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a backward transition', async () => {
      const application = buildApplication({
        status: ApplicationStatus.INTERVIEW,
      });
      prisma.jobApplication.findFirst.mockResolvedValue(application);

      await expect(
        service.updateStatus(userId, applicationId, ApplicationStatus.APPLIED),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('blocks any status change once the application is REJECTED', async () => {
      const application = buildApplication({
        status: ApplicationStatus.REJECTED,
      });
      prisma.jobApplication.findFirst.mockResolvedValue(application);

      await expect(
        service.updateStatus(userId, applicationId, ApplicationStatus.OFFER),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('returns history ordered chronologically after verifying ownership', async () => {
      const application = buildApplication();
      const history = [{ id: 'h1' }, { id: 'h2' }];
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.applicationHistory.findMany.mockResolvedValue(history);

      const result = await service.getHistory(userId, applicationId);

      expect(prisma.applicationHistory.findMany).toHaveBeenCalledWith({
        where: { applicationId },
        orderBy: { changedAt: 'asc' },
      });
      expect(result).toBe(history);
    });

    it('throws NotFoundException when the application is not owned', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(service.getHistory(userId, applicationId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.applicationHistory.findMany).not.toHaveBeenCalled();
    });
  });

  describe('assignResume', () => {
    const resumeId = 'resume-1';

    it('assigns a resume owned by the user to the application', async () => {
      const application = buildApplication();
      const resume = { id: resumeId, userId };
      const updated = buildApplication({ resumeId });
      prisma.jobApplication.findFirst.mockResolvedValue(application);
      prisma.resume.findFirst.mockResolvedValue(resume);
      prisma.jobApplication.update.mockResolvedValue(updated);

      const result = await service.assignResume(
        userId,
        applicationId,
        resumeId,
      );

      expect(prisma.resume.findFirst).toHaveBeenCalledWith({
        where: { id: resumeId, userId },
      });
      expect(prisma.jobApplication.update).toHaveBeenCalledWith({
        where: { id: applicationId },
        data: { resumeId },
      });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when the application is not owned by the user', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(null);

      await expect(
        service.assignResume(userId, applicationId, resumeId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.resume.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the resume is not owned by the user', async () => {
      prisma.jobApplication.findFirst.mockResolvedValue(buildApplication());
      prisma.resume.findFirst.mockResolvedValue(null);

      await expect(
        service.assignResume(userId, applicationId, resumeId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.jobApplication.update).not.toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    const setCounts = (counts: Partial<Record<ApplicationStatus, number>>, total: number) => {
      prisma.jobApplication.count.mockImplementation(
        ({ where }: { where: { status?: ApplicationStatus } }) => {
          if (!where.status) {
            return Promise.resolve(total);
          }

          return Promise.resolve(counts[where.status] ?? 0);
        },
      );
    };

    it('handles an empty application set without dividing by zero', async () => {
      setCounts({}, 0);
      prisma.jobApplication.findMany.mockResolvedValue([]);

      const result = await service.getStatistics(userId);

      expect(result.totalApplications).toBe(0);
      expect(result.byStatus).toEqual({
        applied: 0,
        assessment: 0,
        interview: 0,
        offer: 0,
        rejected: 0,
      });
      expect(result.rates).toEqual({
        assessmentRate: 0,
        interviewRate: 0,
        offerRate: 0,
        rejectionRate: 0,
        interviewToOfferRate: 0,
      });
      expect(result.analytics).toEqual({
        activePipeline: 0,
        successfulApplications: 0,
        averageApplicationsPerMonth: 0,
        monthlyApplications: [],
      });
    });

    it('computes counts by status, rates, and pipeline analytics', async () => {
      setCounts(
        {
          [ApplicationStatus.APPLIED]: 2,
          [ApplicationStatus.ASSESSMENT]: 1,
          [ApplicationStatus.INTERVIEW]: 1,
          [ApplicationStatus.OFFER]: 1,
          [ApplicationStatus.REJECTED]: 1,
        },
        6,
      );
      prisma.jobApplication.findMany.mockResolvedValue([
        { createdAt: new Date('2026-01-05'), status: ApplicationStatus.APPLIED },
        { createdAt: new Date('2026-01-10'), status: ApplicationStatus.APPLIED },
        { createdAt: new Date('2026-02-01'), status: ApplicationStatus.ASSESSMENT },
        { createdAt: new Date('2026-02-15'), status: ApplicationStatus.INTERVIEW },
        { createdAt: new Date('2026-02-20'), status: ApplicationStatus.OFFER },
        { createdAt: new Date('2026-02-25'), status: ApplicationStatus.REJECTED },
      ]);

      const result = await service.getStatistics(userId);

      expect(result.totalApplications).toBe(6);
      expect(result.byStatus).toEqual({
        applied: 2,
        assessment: 1,
        interview: 1,
        offer: 1,
        rejected: 1,
      });
      // assessment+interview+offer = 3 of 6 = 50%
      expect(result.rates.assessmentRate).toBe(50);
      // interview+offer = 2 of 6 = 33.33%
      expect(result.rates.interviewRate).toBe(33.33);
      expect(result.rates.offerRate).toBe(16.67);
      expect(result.rates.rejectionRate).toBe(16.67);
      // offer / (interview + offer) = 1 / 2 = 50%
      expect(result.rates.interviewToOfferRate).toBe(50);
      expect(result.analytics.activePipeline).toBe(4);
      expect(result.analytics.successfulApplications).toBe(1);
      expect(result.analytics.monthlyApplications).toEqual([
        { month: '2026-01', count: 2 },
        { month: '2026-02', count: 4 },
      ]);
    });

    it('returns 0 for interviewToOfferRate when there are no interviews or offers', async () => {
      setCounts(
        {
          [ApplicationStatus.APPLIED]: 1,
          [ApplicationStatus.INTERVIEW]: 0,
          [ApplicationStatus.OFFER]: 0,
        },
        1,
      );
      prisma.jobApplication.findMany.mockResolvedValue([
        { createdAt: new Date('2026-01-05'), status: ApplicationStatus.APPLIED },
      ]);

      const result = await service.getStatistics(userId);

      expect(result.rates.interviewToOfferRate).toBe(0);
    });

    it('keeps only the most recent 6 months of aggregated data', async () => {
      setCounts({}, 8);
      const months = [
        '2025-06',
        '2025-07',
        '2025-08',
        '2025-09',
        '2025-10',
        '2025-11',
        '2025-12',
        '2026-01',
      ];
      prisma.jobApplication.findMany.mockResolvedValue(
        months.map((month) => ({
          createdAt: new Date(`${month}-01T00:00:00.000Z`),
          status: ApplicationStatus.APPLIED,
        })),
      );

      const result = await service.getStatistics(userId);

      expect(result.analytics.monthlyApplications).toHaveLength(6);
      expect(result.analytics.monthlyApplications[0].month).toBe('2025-08');
      expect(result.analytics.monthlyApplications[5].month).toBe('2026-01');
    });
  });
});
