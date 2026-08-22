import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'test@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'password123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: 'Test',
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    example: 'User',
  })
  @IsOptional()
  @IsString()
  lastName?: string;
}