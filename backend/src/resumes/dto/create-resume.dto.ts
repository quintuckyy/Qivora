import { IsString, MinLength } from 'class-validator';

export class CreateResumeDto {
  @IsString()
  @MinLength(1)
  name!: string;
}