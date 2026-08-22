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
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NotesService } from './notes.service';
import { ApiCreatedResponse, ApiOkResponse, ApiBearerAuth, ApiOperation, ApiTags, } from '@nestjs/swagger';

type JwtUser = {
  sub: string;
};

@ApiTags('notes')
@ApiBearerAuth()
@Controller('applications/:applicationId/notes')
@UseGuards(JwtAuthGuard)

export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @ApiOperation({
    summary: 'Add a note for a job application',
  })
  @ApiCreatedResponse({
    description: 'Application note created successfully',
  })
  @Post()
  create(
    @CurrentUser() user: JwtUser,
    @Param('applicationId') applicationId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notesService.create(
      user.sub,
      applicationId,
      dto,
    );
  }
  @ApiOperation({
    summary: 'Get all notes for a job application',
  })
  @ApiOkResponse({
    description: 'Application notes retrieved successfully',
  })
  @Get()
  findAll(
    @CurrentUser() user: JwtUser,
    @Param('applicationId') applicationId: string,
  ) {
    return this.notesService.findAll(
      user.sub,
      applicationId,
    );
  }

  @ApiOperation({
    summary: 'Update an application note',
  })

  @Patch(':noteId')
  update(
    @CurrentUser() user: JwtUser,
    @Param('applicationId') applicationId: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(
      user.sub,
      applicationId,
      noteId,
      dto,
    );
  }
  @ApiOperation({
    summary: 'Delete an application note',
  })

  @Delete(':noteId')
  remove(
    @CurrentUser() user: JwtUser,
    @Param('applicationId') applicationId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.remove(
      user.sub,
      applicationId,
      noteId,
    );
  }
}