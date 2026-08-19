import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'node:path';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResumesService } from './resumes.service';

type JwtUser = {
  sub: string;
};

@Controller('resumes')
@UseGuards(JwtAuthGuard)
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/resumes',
        filename: (_req, file, callback) => {
          const uniqueName =
            `${Date.now()}-${Math.round(Math.random() * 1_000_000_000)}`;

          callback(
            null,
            `${uniqueName}${extname(file.originalname)}`,
          );
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (_req, file, callback) => {
        const allowedMimeTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Only PDF, DOC, and DOCX files are allowed',
            ),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  upload(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const name = file?.originalname ?? 'Resume';

    return this.resumesService.create(
      user.sub,
      name,
      file,
    );
  }

  @Get()
  findAll(@CurrentUser() user: JwtUser) {
    return this.resumesService.findAll(user.sub);
  }

  @Get(':id/download')
  async download(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const resume = await this.resumesService.findOne(
      user.sub,
      id,
    );

    return response.download(
      resume.filePath,
      resume.originalName,
    );
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.resumesService.remove(user.sub, id);
  }
}