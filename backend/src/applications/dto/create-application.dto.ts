import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { ApplicationStatus } from '../../generated/prisma/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}