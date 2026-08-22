import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ApplicationStatus } from '../../generated/prisma/enums';

export class UpdateStatusDto {
  @ApiProperty({
    enum: ApplicationStatus,
    example: ApplicationStatus.INTERVIEW,
  })
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;
}