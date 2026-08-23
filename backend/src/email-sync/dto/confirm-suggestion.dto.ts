import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmSuggestionDto {
  @ApiPropertyOptional({
    description: 'Override the extracted company before creating a new application.',
  })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({
    description: 'Override the extracted position before creating a new application.',
  })
  @IsOptional()
  @IsString()
  position?: string;
}
