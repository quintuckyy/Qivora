import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignResumeDto {
  @ApiProperty({
    example: 'da2ae4d1-f7a0-4926-87ea-7fe82ae7b725',
  })
  @IsUUID()
  resumeId!: string;
}