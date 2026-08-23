import { parseGmailMessage } from './gmail-message.parser';
import type { GmailMessage } from './gmail-api.client';

function toBase64Url(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

describe('parseGmailMessage', () => {
  it('extracts headers and a plain-text body from a simple message', () => {
    const message: GmailMessage = {
      id: 'msg-1',
      threadId: 'thread-1',
      internalDate: '1735689600000',
      payload: {
        headers: [
          { name: 'Subject', value: 'Your application to Acme Robotics' },
          { name: 'From', value: 'careers@acmerobotics.com' },
        ],
        mimeType: 'text/plain',
        body: { data: toBase64Url('Thank you for applying to Acme Robotics.') },
      },
    };

    const parsed = parseGmailMessage(message);

    expect(parsed.subject).toBe('Your application to Acme Robotics');
    expect(parsed.from).toBe('careers@acmerobotics.com');
    expect(parsed.bodyText).toBe('Thank you for applying to Acme Robotics.');
    expect(parsed.receivedAt).toEqual(new Date(1735689600000));
  });

  it('prefers text/plain over text/html when a multipart message has both', () => {
    const message: GmailMessage = {
      id: 'msg-2',
      threadId: 'thread-2',
      payload: {
        headers: [{ name: 'Subject', value: 'Interview invitation' }],
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { data: toBase64Url('Plain text body.') } },
          { mimeType: 'text/html', body: { data: toBase64Url('<p>HTML body.</p>') } },
        ],
      },
    };

    expect(parseGmailMessage(message).bodyText).toBe('Plain text body.');
  });

  it('falls back to a stripped text/html body when no text/plain part exists', () => {
    const message: GmailMessage = {
      id: 'msg-3',
      threadId: 'thread-3',
      payload: {
        headers: [{ name: 'Subject', value: 'Offer' }],
        mimeType: 'multipart/mixed',
        parts: [
          {
            mimeType: 'multipart/related',
            parts: [{ mimeType: 'text/html', body: { data: toBase64Url('<div>Congrats!<br>Welcome.</div>') } }],
          },
        ],
      },
    };

    const parsed = parseGmailMessage(message);
    expect(parsed.bodyText).toContain('Congrats!');
    expect(parsed.bodyText).toContain('Welcome.');
    expect(parsed.bodyText).not.toContain('<div>');
  });

  it('returns empty strings and a null date instead of throwing when payload is missing', () => {
    const message: GmailMessage = { id: 'msg-4', threadId: 'thread-4' };
    const parsed = parseGmailMessage(message);

    expect(parsed.subject).toBe('');
    expect(parsed.from).toBe('');
    expect(parsed.bodyText).toBe('');
    expect(parsed.receivedAt).toBeNull();
  });
});
