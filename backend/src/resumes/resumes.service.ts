import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ResumesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    name: string,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Resume file is required');
    }

    return this.prisma.resume.create({
      data: {
        name,
        originalName: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
        filePath: file.path,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.resume.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(userId: string, id: string) {
    const resume = await this.prisma.resume.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    return resume;
  }

  async remove(userId: string, id: string) {
    const resume = await this.findOne(userId, id);

    await this.prisma.resume.delete({
      where: {
        id,
      },
    });

    try {
      await unlink(resume.filePath);
    } catch {
      // File may already be missing.
    }

    return {
      message: 'Resume deleted successfully',
    };
  }
}