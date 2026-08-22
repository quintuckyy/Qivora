import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateResumeDto {
  @ApiProperty({
    example: 'Senior .NET Resume',
  })
  @IsString()
  @MinLength(1)
  name!: string;
}