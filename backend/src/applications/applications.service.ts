import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { QueryApplicationsDto } from './dto/query-applications.dto';
import { ApplicationStatus } from '../generated/prisma/enums';


@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateApplicationDto) {
    return this.prisma.jobApplication.create({
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
  }

  /** Scoped to the caller so one user's saved jobs never leak into another's
   * duplicate check — same ownership boundary as every other query here. */
  async checkDuplicate(userId: string, jobUrl: string) {
    const application = await this.prisma.jobApplication.findFirst({
      where: { userId, jobUrl },
      select: {
        id: true,
        company: true,
        position: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      exists: application !== null,
      application,
    };
  }

  async findAll(userId: string, query: QueryApplicationsDto) {
    const {
        page,
        limit,
        search,
        status,
        sortBy,
        sortOrder,
    } = query;

    const skip = (page - 1) * limit;

    const where = {
        userId,
        ...(status ? { status } : {}),
        ...(search
        ? {
            OR: [
                {
                company: {
                    contains: search,
                    mode: 'insensitive' as const,
                },
                },
                {
                position: {
                    contains: search,
                    mode: 'insensitive' as const,
                },
                },
                {
                location: {
                    contains: search,
                    mode: 'insensitive' as const,
                },
                },
            ],
            }
        : {}),
    };

    const [applications, total] = await this.prisma.$transaction([
        this.prisma.jobApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
            [sortBy]: sortOrder,
        },
        }),
        this.prisma.jobApplication.count({
        where,
        }),
    ]);

    return {
        data: applications,
        meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        },
    };
  }

  async findOne(userId: string, id: string) {
    const application = await this.prisma.jobApplication.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!application) {
      throw new NotFoundException('Job application not found');
    }

    return application;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateApplicationDto,
  ) {
    await this.findOne(userId, id);

    return this.prisma.jobApplication.update({
      where: {
        id,
      },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.jobApplication.delete({
      where: {
        id,
      },
    });
  }

  async updateStatus(
    userId: string,
    id: string,
    newStatus: ApplicationStatus,
  ) {
    const application = await this.findOne(userId, id);

    if (application.status === newStatus) {
        throw new BadRequestException(
        `Application is already ${newStatus}`,
        );
    }

    if (application.status === ApplicationStatus.REJECTED) {
        throw new BadRequestException(
        'Rejected applications cannot change status',
        );
    }

    const statusOrder: ApplicationStatus[] = [
        ApplicationStatus.APPLIED,
        ApplicationStatus.ASSESSMENT,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFER,
    ];

    if (newStatus !== ApplicationStatus.REJECTED) {
        const currentIndex = statusOrder.indexOf(application.status);
        const newIndex = statusOrder.indexOf(newStatus);

        if (newIndex <= currentIndex) {
        throw new BadRequestException(
            'Application status cannot move backwards',
        );
        }
    }

    return this.prisma.$transaction(async (tx) => {
        const updated = await tx.jobApplication.update({
        where: {
            id,
        },
        data: {
            status: newStatus,
        },
        });

        await tx.applicationHistory.create({
        data: {
            applicationId: id,
            fromStatus: application.status,
            toStatus: newStatus,
        },
        });

        return updated;
    });
  }

  async getHistory(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.applicationHistory.findMany({
        where: {
        applicationId: id,
        },
        orderBy: {
        changedAt: 'asc',
        },
    });
  }

  async assignResume(
    userId: string,
    applicationId: string,
    resumeId: string,
  ) {
    await this.findOne(userId, applicationId);

    const resume = await this.prisma.resume.findFirst({
        where: {
        id: resumeId,
        userId,
        },
    });

    if (!resume) {
        throw new NotFoundException('Resume not found');
    }

    return this.prisma.jobApplication.update({
        where: {
        id: applicationId,
        },
        data: {
        resumeId,
        },
    });
  }

  async getStatistics(userId: string) {
    const [
        total,
        applied,
        assessment,
        interview,
        offer,
        rejected,
    ] = await this.prisma.$transaction([
        this.prisma.jobApplication.count({
        where: { userId },
        }),

        this.prisma.jobApplication.count({
        where: {
            userId,
            status: ApplicationStatus.APPLIED,
        },
        }),

        this.prisma.jobApplication.count({
        where: {
            userId,
            status: ApplicationStatus.ASSESSMENT,
        },
        }),

        this.prisma.jobApplication.count({
        where: {
            userId,
            status: ApplicationStatus.INTERVIEW,
        },
        }),

        this.prisma.jobApplication.count({
        where: {
            userId,
            status: ApplicationStatus.OFFER,
        },
        }),

        this.prisma.jobApplication.count({
        where: {
            userId,
            status: ApplicationStatus.REJECTED,
        },
        }),
    ]);

    const applications = await this.prisma.jobApplication.findMany({
        where: {
        userId,
        },
        select: {
        createdAt: true,
        status: true,
        },
        orderBy: {
        createdAt: 'asc',
        },
    });

    const percentage = (value: number, base: number) => {
        if (base === 0) {
        return 0;
        }

        return Number(((value / base) * 100).toFixed(2));
    };

    const monthlyMap = new Map<string, number>();

    for (const application of applications) {
        const month = application.createdAt
        .toISOString()
        .slice(0, 7);

        monthlyMap.set(
        month,
        (monthlyMap.get(month) ?? 0) + 1,
        );
    }

    const monthlyApplications = Array.from(
        monthlyMap.entries(),
    )
        .map(([month, count]) => ({
        month,
        count,
        }))
        .slice(-6);

    const activePipeline =
        applied + assessment + interview;

    const successfulApplications = offer;

    const averageApplicationsPerMonth =
        monthlyApplications.length === 0
        ? 0
        : Number(
            (
                total / monthlyApplications.length
            ).toFixed(2),
            );

    return {
        totalApplications: total,

        byStatus: {
        applied,
        assessment,
        interview,
        offer,
        rejected,
        },

        rates: {
        assessmentRate: percentage(
            assessment + interview + offer,
            total,
        ),

        interviewRate: percentage(
            interview + offer,
            total,
        ),

        offerRate: percentage(
            offer,
            total,
        ),

        rejectionRate: percentage(
            rejected,
            total,
        ),

        interviewToOfferRate: percentage(
            offer,
            interview + offer,
        ),
        },

        analytics: {
        activePipeline,
        successfulApplications,
        averageApplicationsPerMonth,
        monthlyApplications,
        },
    };
  }  
}
