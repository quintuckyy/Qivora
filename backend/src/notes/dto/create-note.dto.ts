import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateNoteDto {
  @ApiProperty({
    example: 'Recruiter said the next stage is a technical interview.',
  })
  @IsString()
  @MinLength(1)
  content!: string;
}