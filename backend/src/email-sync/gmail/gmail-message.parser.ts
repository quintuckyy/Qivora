import type { GmailMessage, GmailMessagePart } from './gmail-api.client';

export interface ParsedGmailMessage {
  subject: string;
  from: string;
  receivedAt: Date | null;
  bodyText: string;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
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
    return { plain: decodeBase64Url(part.body.data) };
  }
  if (part.mimeType === 'text/html' && part.body?.data) {
    return { html: decodeBase64Url(part.body.data) };
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
