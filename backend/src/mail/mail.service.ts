import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

interface ParsedSender {
  email: string;
  name?: string;
}

/** Brevo's API wants the sender as separate {name, email} fields, but
 * MAIL_FROM is documented (and every other provider accepts it) in the
 * combined "Name <email@domain>" form — so this pulls the two apart, or
 * falls back to treating the whole string as a bare email address. */
function parseSender(from: string): ParsedSender {
  const match = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim();
    return { email: match[2].trim(), name: name || undefined };
  }
  return { email: from.trim() };
}

/** Sends transactional email via Brevo's HTTP API — deliberately never the
 * user's own connected Gmail account (email-sync only ever *reads* a
 * user's inbox with read-only OAuth scope; sending from it would require a
 * much broader grant and would mean password-reset emails came from a
 * random user's personal address instead of the app).
 *
 * Opt-in like Gmail sync: without BREVO_API_KEY/MAIL_FROM configured, the
 * app still boots and this just logs the email instead of sending it —
 * handy for local dev, and it means forgot-password's generic response
 * still works out of the box before anyone sets up a mail provider. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const subject = 'Reset your Qivora password';
    const html = `
      <p>We received a request to reset your Qivora password.</p>
      <p><a href="${resetUrl}">Click here to choose a new password</a>. This link expires in 20 minutes.</p>
      <p>If you didn't request this, you can safely ignore this email — your password won't be changed.</p>
    `.trim();

    const apiKey = this.config.get<string>('BREVO_API_KEY');
    const from = this.config.get<string>('MAIL_FROM');

    if (!apiKey || !from) {
      this.logger.warn(
        `Mail provider not configured (BREVO_API_KEY/MAIL_FROM) — would have sent "${subject}" to ${to}. Reset link: ${resetUrl}`,
      );
      return;
    }

    try {
      const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: parseSender(from),
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.error(
          `Brevo API returned ${response.status} sending password reset email to ${to}: ${body}`,
        );
      }
    } catch (error) {
      // Never let a mail-provider outage surface to the caller — forgot-password
      // must always return its generic response regardless of delivery success.
      this.logger.error(
        `Failed to send password reset email to ${to}: ${(error as Error).message}`,
      );
    }
  }
}
