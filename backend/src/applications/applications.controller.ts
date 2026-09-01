import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { QueryApplicationsDto } from './dto/query-applications.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignResumeDto } from './dto/assign-resume.dto';
import { CheckDuplicateDto } from './dto/check-duplicate.dto';
import { ApiBearerAuth, ApiNotFoundResponse, ApiBadRequestResponse, ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';

type JwtUser = {
  sub: string;
};

@ApiTags('applications')
@ApiBearerAuth()
@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
  ) {}

  @ApiOperation({
    summary: 'Create a job application',
  })
  @Post()
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(user.sub, dto);
  }

  @ApiOperation({
    summary: 'Get job applications with pagination, filtering, search, and sorting',
    })
  @ApiOkResponse({
    description: 'Paginated job applications retrieved successfully',
    schema: {
        example: {
        data: [
            {
            id: 'd5c41086-0173-45cd-946e-d48712c7bd52',
            company: 'Infor',
            position: 'Senior Software Engineer',
            status: 'APPLIED',
            salaryMin: 140000,
            salaryMax: 160000,
            location: 'Taguig, Metro Manila',
            jobUrl: 'https://careers.example.com/jobs/123',
            createdAt: '2026-08-22T12:00:00.000Z',
            updatedAt: '2026-08-22T12:00:00.000Z',
            userId: '3134c892-6eb4-478a-b82b-cc31d7cd4bfe',
            resumeId: null,
            },
        ],
        meta: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
        },
        },
    },
  })
  @Get()
  findAll(
    @CurrentUser() user: JwtUser,
    @Query() query: QueryApplicationsDto,
  ) {
    return this.applicationsService.findAll(user.sub, query);
  }

  @ApiOperation({
    summary: 'Get application statistics and conversion rates',
  })

  @ApiOkResponse({
    description: 'Application statistics retrieved successfully',
    schema: {
        example: {
        totalApplications: 3,
        byStatus: {
            applied: 2,
            assessment: 0,
            interview: 1,
            offer: 0,
            rejected: 0,
        },
        rates: {
            assessmentRate: 33.33,
            interviewRate: 33.33,
            offerRate: 0,
            rejectionRate: 0,
            interviewToOfferRate: 0,
        },
        analytics: {
            activePipeline: 3,
            successfulApplications: 0,
            averageApplicationsPerMonth: 3,
            monthlyApplications: [
            {
                month: '2026-08',
                count: 3,
            },
            ],
        },
        },
    },
  })
  
  @Get('statistics')
    getStatistics(
    @CurrentUser() user: JwtUser,
  ) {
    return this.applicationsService.getStatistics(user.sub);
  }

  @ApiOperation({
    summary:
      'Get deeper job-search analytics: conversion funnel, milestone timing, per-source conversion, and month-over-month comparison',
  })
  @ApiOkResponse({
    description: 'Analytics retrieved successfully',
  })
  @Get('analytics')
  getAnalytics(@CurrentUser() user: JwtUser) {
    return this.applicationsService.getAnalytics(user.sub);
  }

  @ApiOperation({
    summary: 'Check whether the caller already has an application for a job URL',
  })
  @ApiOkResponse({
    description: 'Duplicate check result',
    schema: {
      example: {
        exists: true,
        application: {
          id: 'd5c41086-0173-45cd-946e-d48712c7bd52',
          company: 'Infor',
          position: 'Senior Software Engineer',
          status: 'APPLIED',
          createdAt: '2026-08-22T12:00:00.000Z',
        },
      },
    },
  })
  @Get('check-duplicate')
  checkDuplicate(
    @CurrentUser() user: JwtUser,
    @Query() query: CheckDuplicateDto,
  ) {
    return this.applicationsService.checkDuplicate(user.sub, query.jobUrl);
  }

  @ApiOperation({
    summary: 'Get a job application by ID',
  })
  @ApiNotFoundResponse({
    description: 'Application not found',
  })
  @ApiOkResponse({
    description: 'Job application retrieved successfully',
  })
  @Get(':id')
  findOne(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.applicationsService.findOne(user.sub, id);
  }

  @ApiOperation({
    summary: 'Update a job application',
  })
  @ApiOkResponse({
    description: 'Job application updated successfully',
  })
  @ApiNotFoundResponse({
    description: 'Job application not found',
  })
  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.applicationsService.update(user.sub, id, dto);
  }

  @ApiOperation({
    summary: 'Update application workflow status',
  })
  @ApiOkResponse({
    description: 'Application status updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid application status transition',
  })
  @ApiNotFoundResponse({
    description: 'Job application not found',
  })
  @Patch(':id/status')
    updateStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.applicationsService.updateStatus(
        user.sub,
        id,
        dto.status,
    );
  }

  @ApiOperation({
    summary: 'Assign a resume to a job application',
  })
  @ApiOkResponse({
    description: 'Resume assigned successfully',
  })
  @ApiNotFoundResponse({
    description: 'Job application or resume not found',
  })
  @Patch(':id/resume')
    assignResume(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AssignResumeDto,
    ) {
    return this.applicationsService.assignResume(
        user.sub,
        id,
        dto.resumeId,
    );
  }

  @ApiOperation({
    summary: 'Get application status history',
  })
  @ApiOkResponse({
    description: 'Application history retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Job application not found',
  })
  @Get(':id/history')
  getHistory(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.applicationsService.getHistory(user.sub, id);
  }

  @ApiOperation({
  summary: 'Delete a job application',
  })
  @ApiOkResponse({
    description: 'Job application deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'Job application not found',
  })
  @Delete(':id')
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.applicationsService.remove(user.sub, id);
  }
}
