import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class UpdateInterviewDto {
  @ApiPropertyOptional({
    example: 'Final Technical Interview',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: '2026-08-27T14:00:00+08:00',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    example: 'BGC, Taguig',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    example: 'https://teams.microsoft.com/example',
  })
  @IsOptional()
  @IsUrl()
  meetingUrl?: string;

  @ApiPropertyOptional({
    example: 'Focus on architecture and behavioral questions.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}