import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateResumeDto {
  @ApiProperty({
    example: 'Backend .NET',
    description: 'New display label for the resume version.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
