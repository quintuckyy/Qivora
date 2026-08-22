import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApplicationStatus } from '../../generated/prisma/enums';

export class QueryApplicationsDto {
  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @ApiPropertyOptional({
    example: 'Infor',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ApplicationStatus,
    example: ApplicationStatus.APPLIED,
  })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({
    enum: [
      'createdAt',
      'updatedAt',
      'company',
      'position',
      'salaryMin',
      'salaryMax',
    ],
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn([
    'createdAt',
    'updatedAt',
    'company',
    'position',
    'salaryMin',
    'salaryMax',
  ])
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    example: 'desc',
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}