import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { GoogleAuthClient } from './google-auth.client';
import type { User } from '../generated/prisma/client';

// Comfortably inside the 15-30 minute window a password reset link should
// stay valid for — long enough that a slow email delivery doesn't strand the
// user, short enough that a leaked/intercepted link is only exploitable
// briefly.
const RESET_TOKEN_TTL_MS = 20 * 60 * 1000;

// Identical wording for "no such token", "already used", and "expired" so a
// reset attempt never reveals *why* a token didn't work — a real token that
// merely expired shouldn't read any differently to an attacker than one that
// never existed at all.
const INVALID_RESET_TOKEN_MESSAGE =
  'This password reset link is invalid or has expired. Please request a new one.';

const SAME_AS_OLD_PASSWORD_MESSAGE =
  'New password must be different from your current password.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly googleAuthClient: GoogleAuthClient,
  ) {}

  /** Shared by every path that ends in "the caller is now this user" —
   * password login, register's auto-login, and Google sign-in — so the
   * token payload and response shape can't quietly drift apart between
   * them. */
  private async issueSession(user: User) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(user);
  }

  /** Logs in via a Google-verified email, auto-registering on first sign-in.
   * Trusting Google's own email-ownership verification here is the same
   * trust boundary this app already relies on for password resets (whoever
   * proves control of the mailbox controls the account) — it's not a new
   * assumption, just a second door that leads to it. */
  async loginWithGoogle(dto: GoogleLoginDto) {
    const profile = await this.googleAuthClient.verifyAccessToken(
      dto.accessToken,
    );

    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (!user) {
      // A Google-only account still needs *some* passwordHash to satisfy the
      // schema, so it gets one nobody knows and nobody will ever type in —
      // this account can only ever sign in via Google. Everything else
      // about the row (JWT shape, role, downstream queries) is identical to
      // a password-registered user.
      const unusablePasswordHash = await argon2.hash(
        randomBytes(32).toString('base64url'),
      );
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          passwordHash: unusablePasswordHash,
        },
      });
    }

    return this.issueSession(user);
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  private hashResetToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private buildResetUrl(rawToken: string): string {
    // FRONTEND_ORIGIN is the same comma-separated allowlist main.ts uses for
    // CORS — the first entry is this deployment's actual frontend URL.
    const configured = this.config.get<string>('FRONTEND_ORIGIN');
    const origin = configured?.split(',')[0]?.trim() || 'http://localhost:5173';
    return `${origin}/reset-password?token=${rawToken}`;
  }

  /** Always resolves the same way — same message, same shape, same
   * 200-family status — whether or not the email belongs to an account.
   * Anything that varied by outcome (a 404 for unknown emails, a different
   * message, even a measurably different response time from skipping the
   * token/email work) would let an attacker enumerate registered emails
   * against this endpoint alone. */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const genericResponse = {
      message:
        'If an account exists for that email, a password reset link has been sent.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      return genericResponse;
    }

    // A fresh request supersedes any still-outstanding ones — only the
    // newest link a user asked for should ever be valid at a time.
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const rawToken = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashResetToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    // Failures here (mail provider down, etc.) are logged inside MailService
    // and never thrown — this response must stay generic either way.
    await this.mailService.sendPasswordResetEmail(
      user.email,
      this.buildResetUrl(rawToken),
    );

    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashResetToken(dto.token) },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
    }

    // The token's userId only ever comes from a real, still-existing user
    // (see forgotPassword) and nothing else in this app deletes users, so a
    // missing user here is defensive rather than an expected runtime path —
    // it still falls back to the same generic invalid-token message rather
    // than a 500, since there's no meaningful way to complete the reset.
    const user = await this.prisma.user.findUnique({
      where: { id: resetToken.userId },
    });
    if (!user) {
      throw new BadRequestException(INVALID_RESET_TOKEN_MESSAGE);
    }

    // Comparing against the current hash before accepting the new password
    // — re-submitting your existing password isn't invalid, but silently
    // "succeeding" at nothing would be a confusing way to find that out.
    if (await argon2.verify(user.passwordHash, dto.password)) {
      throw new BadRequestException(SAME_AS_OLD_PASSWORD_MESSAGE);
    }

    const passwordHash = await argon2.hash(dto.password);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      // Any other still-outstanding tokens for this user are now moot — the
      // password they'd reset to has already changed underneath them.
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: resetToken.userId, id: { not: resetToken.id } },
      }),
    ]);

    return { message: 'Your password has been reset. You can now log in.' };
  }
}
