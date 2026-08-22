import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateInterviewDto {
  @ApiProperty({
    example: 'Technical Interview',
  })
  @IsString()
  title!: string;

  @ApiProperty({
    example: '2026-08-25T10:00:00+08:00',
  })
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional({
    example: 'Taguig, Metro Manila',
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
    example: 'Prepare .NET Core and system design topics.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}