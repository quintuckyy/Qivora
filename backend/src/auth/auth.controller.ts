import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Register a new user',
    })
    @ApiCreatedResponse({
    description: 'User registered successfully',
    schema: {
        example: {
        id: '3134c892-6eb4-478a-b82b-cc31d7cd4bfe',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        createdAt: '2026-08-22T12:00:00.000Z',
        },
    },
  })

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({
    summary: 'Login and receive an access token',
    })
    @ApiOkResponse({
    description: 'Login successful',
    schema: {
        example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
            id: '3134c892-6eb4-478a-b82b-cc31d7cd4bfe',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'USER',
        },
        },
    },
  })

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}