import type { GmailMessage, GmailMessagePart } from './gmail-api.client';

export interface ParsedGmailMessage {
  subject: string;
  from: string;
  receivedAt: Date | null;
  bodyText: string;
}

function decodeBase64Url(data: string): Buffer {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

/** The Gmail API hands back a part's raw bytes (base64url-wrapped for
 * JSON), not the decoded text — whatever Content-Transfer-Encoding the
 * original message used is still applied on top. Quoted-printable is a
 * very common one (any non-ASCII character, like an em dash or accented
 * letter, tends to trigger it), and without this a real LinkedIn
 * confirmation email came through as literal "=E2=80=93" in place of an
 * en dash and "=3D" in place of every "=" sign, with soft line-wraps
 * ("=\n") splitting words and even URLs mid-string — silently garbling
 * text for every provider, not just this one case. */
function decodeQuotedPrintable(text: string): string {
  const withoutSoftBreaks = text.replace(/=\r?\n/g, '');
  const bytes = Buffer.from(
    withoutSoftBreaks.replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))),
    'binary',
  );
  return bytes.toString('utf-8');
}

function decodePartBody(part: GmailMessagePart, data: string): string {
  const encoding = part.headers
    ?.find((h) => h.name.toLowerCase() === 'content-transfer-encoding')
    ?.value?.trim()
    .toLowerCase();

  const raw = decodeBase64Url(data);
  return encoding === 'quoted-printable' ? decodeQuotedPrintable(raw.toString('utf-8')) : raw.toString('utf-8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Walks the MIME part tree depth-first, preferring text/plain over
 * text/html (no HTML stripping needed) and returning the first of whichever
 * kind appears first — good enough for classification, not a full renderer. */
function findBody(part: GmailMessagePart | undefined): { plain?: string; html?: string } {
  if (!part) return {};

  if (part.mimeType === 'text/plain' && part.body?.data) {
    return { plain: decodePartBody(part, part.body.data) };
  }
  if (part.mimeType === 'text/html' && part.body?.data) {
    return { html: decodePartBody(part, part.body.data) };
  }

  const result: { plain?: string; html?: string } = {};
  for (const child of part.parts ?? []) {
    const found = findBody(child);
    if (found.plain && !result.plain) result.plain = found.plain;
    if (found.html && !result.html) result.html = found.html;
    if (result.plain) break;
  }
  return result;
}

export function parseGmailMessage(message: GmailMessage): ParsedGmailMessage {
  const headers = message.payload?.headers ?? [];
  const header = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

  const { plain, html } = findBody(message.payload);
  const bodyText = plain ?? (html ? stripHtml(html) : '');

  const internalDateMs = message.internalDate ? Number(message.internalDate) : NaN;
  const receivedAt = Number.isFinite(internalDateMs) ? new Date(internalDateMs) : null;

  return {
    subject: header('Subject'),
    from: header('From'),
    receivedAt,
    bodyText: bodyText.slice(0, 20_000), // classification never needs more than this
  };
}
