import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AUTH_LIMIT, PASSWORD_RESET_LIMIT } from '../config/throttling';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

// Every credential endpoint below is rate-limited per client IP on top of the
// app-wide baseline (see AppModule) — brute force, credential stuffing, and
// reset-email mail-bombing all hit here first.
@ApiTags('auth')
@Throttle({ default: AUTH_LIMIT })
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

  @ApiOperation({
    summary:
      'Request a password reset link — always returns a generic response, whether or not the email is registered',
  })
  @ApiOkResponse({
    description:
      'Generic acknowledgement (never reveals whether the email exists)',
    schema: {
      example: {
        message:
          'If an account exists for that email, a password reset link has been sent.',
      },
    },
  })
  @Throttle({ default: PASSWORD_RESET_LIMIT })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @ApiOperation({
    summary: 'Reset a password using the token from a forgot-password email',
  })
  @ApiOkResponse({
    description: 'Password reset successfully',
    schema: {
      example: {
        message: 'Your password has been reset. You can now log in.',
      },
    },
  })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiOperation({
    summary: 'Log in with Google, registering automatically on first sign-in',
  })
  @ApiOkResponse({
    description: 'Login successful',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: '3134c892-6eb4-478a-b82b-cc31d7cd4bfe',
          email: 'test@example.com',
          firstName: null,
          lastName: null,
          role: 'USER',
        },
      },
    },
  })
  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto);
  }
}
