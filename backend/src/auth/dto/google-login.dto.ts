import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description:
      'OAuth access token obtained client-side from Google Identity Services (openid email scope)',
  })
  @IsString()
  @IsNotEmpty()
  accessToken!: string;
}
