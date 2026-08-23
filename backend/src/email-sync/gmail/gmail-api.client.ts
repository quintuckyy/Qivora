import { Injectable, InternalServerErrorException } from '@nestjs/common';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface GmailMessageHeader {
  name: string;
  value: string;
}

export interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: GmailMessagePart & { headers?: GmailMessageHeader[] };
}

async function gmailFetch(accessToken: string, path: string): Promise<Response> {
  return fetch(`${GMAIL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

@Injectable()
export class GmailApiClient {
  /** Lists recent candidate message ids matching `query`, capped at
   * `maxResults` — this is a coarse prefilter (Gmail's own search operators),
   * not the classifier; every returned id is still run through our own
   * subject/body classification before anything is suggested. */
  async listMessageIds(
    accessToken: string,
    options: { query: string; maxResults: number },
  ): Promise<{ id: string; threadId: string }[]> {
    const params = new URLSearchParams({
      q: options.query,
      maxResults: String(options.maxResults),
    });

    const response = await gmailFetch(accessToken, `/messages?${params.toString()}`);
    if (!response.ok) {
      throw new InternalServerErrorException('Failed to list Gmail messages.');
    }

    const body = (await response.json()) as { messages?: { id: string; threadId: string }[] };
    return body.messages ?? [];
  }

  async getMessage(accessToken: string, id: string): Promise<GmailMessage> {
    const response = await gmailFetch(accessToken, `/messages/${id}?format=full`);
    if (!response.ok) {
      throw new InternalServerErrorException(`Failed to fetch Gmail message ${id}.`);
    }

    return (await response.json()) as GmailMessage;
  }
}
