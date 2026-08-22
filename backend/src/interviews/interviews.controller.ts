import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { InterviewsService } from './interviews.service';
import { ApiCreatedResponse, ApiOkResponse, ApiBearerAuth, ApiOperation, ApiTags, } from '@nestjs/swagger';

type JwtUser = {
  sub: string;
};

@ApiTags('interviews')
@ApiBearerAuth()
@Controller('applications/:applicationId/interviews')
@UseGuards(JwtAuthGuard)
export class InterviewsController {
  constructor(
    private readonly interviewsService: InterviewsService,
  ) {}

  @ApiOperation({
    summary: 'Schedule an interview for a job application',
    })
    @ApiCreatedResponse({
    description: 'Interview scheduled successfully',
  })

  @Post()
  create(
    @CurrentUser() user: JwtUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: CreateInterviewDto,
  ) {
    return this.interviewsService.create(
      user.sub,
      applicationId,
      dto,
    );
  }

  @ApiOperation({
    summary: 'Get all interviews for a job application',
  })
  @ApiOkResponse({
    description: 'Interviews retrieved successfully',
  })

  @Get()
  findAll(
    @CurrentUser() user: JwtUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.interviewsService.findAll(
      user.sub,
      applicationId,
    );
  }

  @ApiOperation({
    summary: 'Update an interview',
  })

  @Patch(':interviewId')
  update(
    @CurrentUser() user: JwtUser,
    @Param('applicationId') applicationId: string,
    @Param('interviewId') interviewId: string,
    @Body() dto: UpdateInterviewDto,
  ) {
    return this.interviewsService.update(
      user.sub,
      applicationId,
      interviewId,
      dto,
    );
  }

  @ApiOperation({
    summary: 'Delete an interview',
  })

  @Delete(':interviewId')
  remove(
    @CurrentUser() user: JwtUser,
    @Param('applicationId') applicationId: string,
    @Param('interviewId') interviewId: string,
  ) {
    return this.interviewsService.remove(
      user.sub,
      applicationId,
      interviewId,
    );
  }
}