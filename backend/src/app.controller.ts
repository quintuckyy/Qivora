import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CurrentUser } from './auth/decorators/current-user.decorator';
import { Roles } from './auth/decorators/roles.decorator';
import { RolesGuard } from './auth/guards/roles.guard';
import { Role } from './generated/prisma/enums';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('protected')
  protectedRoute(@CurrentUser() user: unknown) {
    return {
      message: 'You are authenticated',
      user,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin')
  adminRoute() {
    return {
      message: 'Admin access granted',
    };
  }
}
