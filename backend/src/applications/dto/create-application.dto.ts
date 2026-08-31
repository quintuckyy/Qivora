import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { ApplicationStatus } from '../../generated/prisma/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Display-only provenance labels — see JobApplication.source in the schema. */
export const APPLICATION_SOURCES = [
  'LINKEDIN',
  'JOBSTREET',
  'INDEED',
  'EMAIL_SYNC',
  'MANUAL',
] as const;

export class CreateApplicationDto {
  @ApiProperty({
    example: 'Infor',
  })
  @IsString()
  company!: string;

  @ApiProperty({
    example: 'Senior Software Engineer',
  })
  @IsString()
  position!: string;

  @ApiPropertyOptional({
    enum: ApplicationStatus,
    example: ApplicationStatus.APPLIED,
  })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({
    example: 140000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({
    example: 160000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional({
    example: 'Taguig, Metro Manila',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    example: 'https://careers.example.com/jobs/123',
  })
  @IsOptional()
  @IsUrl()
  jobUrl?: string;

  @ApiPropertyOptional({
    enum: APPLICATION_SOURCES,
    description: 'Display-only origin label; does not affect any behaviour.',
  })
  @IsOptional()
  @IsIn(APPLICATION_SOURCES)
  source?: (typeof APPLICATION_SOURCES)[number];
}