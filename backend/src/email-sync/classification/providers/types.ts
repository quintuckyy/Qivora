import type { EmailInput } from '../types';

export interface ProviderExtraction {
  position: string | null;
  company: string | null;
  applicationDate: Date | null;
}

/**
 * One parser per job board/ATS. `matches` decides ownership from the From
 * header (and, where a platform's own wording is distinctive enough, the
 * subject/body too — some notification systems relay through a generic
 * sending domain). `extract` then applies phrasing specific to that
 * platform's real email templates rather than a one-size-fits-all regex
 * pass, so a template's own vocabulary ("was successfully submitted to",
 * "Your application was sent to", …) is matched precisely instead of
 * guessed at.
 */
export interface EmailProvider {
  /** Reported back to callers as `source` when this provider owns the email. */
  id: string;
  matches(input: EmailInput): boolean;
  extract(input: EmailInput): ProviderExtraction;
}
