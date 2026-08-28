export type DetectedEmailType =
  | 'APPLICATION_RECEIVED'
  | 'ASSESSMENT'
  | 'INTERVIEW'
  | 'REJECTION'
  | 'OFFER'
  | 'OTHER';

export interface EmailInput {
  subject: string;
  bodyText: string;
  from: string;
}

export interface ExtractedEmailInfo {
  type: DetectedEmailType;
  /** 0..1 — how confident the rule-based classifier is in `type`. This is a
   * heuristic signal for the UI (e.g. flag low-confidence rows), not a
   * gate on whether a suggestion is created — every non-OTHER email still
   * goes through the review/confirm step before touching any application. */
  confidence: number;
  company: string | null;
  position: string | null;
  source: string | null;
  /** When the email itself states an explicit date ("...on August 20,
   * 2026"). Never guessed from the received timestamp — callers that want a
   * fallback should use the message's own receivedAt for that. */
  applicationDate: Date | null;
}
