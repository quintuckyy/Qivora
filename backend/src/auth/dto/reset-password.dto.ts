import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description:
      'The raw reset token from the emailed link (not stored anywhere — only its hash is).',
    example: 'a1b2c3...',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({
    example: 'newPassword123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
