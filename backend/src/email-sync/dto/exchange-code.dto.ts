import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExchangeCodeDto {
  @ApiProperty({
    description: 'The authorization code returned by Google in the OAuth redirect.',
  })
  @IsString()
  @MinLength(1)
  code!: string;
}
