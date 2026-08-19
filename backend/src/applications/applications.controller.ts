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

type JwtUser = {
  sub: string;
};

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(user.sub, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtUser,
    @Query() query: QueryApplicationsDto,
  ) {
    return this.applicationsService.findAll(user.sub, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.applicationsService.findOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.applicationsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.applicationsService.remove(user.sub, id);
  }

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

  @Get(':id/history')
    getHistory(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    ) {
        return this.applicationsService.getHistory(user.sub, id);
    }
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
}
