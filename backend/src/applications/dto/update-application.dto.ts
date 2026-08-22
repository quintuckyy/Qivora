import {
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class UpdateApplicationDto {
  @ApiPropertyOptional({
    example: 'Infor',
  })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({
    example: 'Senior Software Engineer',
  })
  @IsOptional()
  @IsString()
  position?: string;

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