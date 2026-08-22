import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateNoteDto {
  @ApiPropertyOptional({
    example: 'Updated note after recruiter follow-up.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;
}