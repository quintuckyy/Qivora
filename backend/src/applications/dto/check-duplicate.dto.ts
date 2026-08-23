import { IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckDuplicateDto {
  @ApiProperty({
    example: 'https://www.linkedin.com/jobs/view/1234567890/',
  })
  @IsUrl()
  jobUrl!: string;
}
