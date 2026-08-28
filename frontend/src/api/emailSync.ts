import { api } from './client';
import type { EmailSuggestion, GmailStatus, GmailSyncResult } from './types';

export interface SuggestionOverrides {
  company?: string;
  position?: string;
}

export const emailSyncApi = {
  getAuthUrl: () => api.get<{ url: string }>('/email-sync/gmail/auth-url'),

  exchangeCode: (code: string) =>
    api.post<{ connected: boolean; email: string }>('/email-sync/gmail/exchange', { code }),

  getStatus: () => api.get<GmailStatus>('/email-sync/gmail/status'),

  disconnect: () => api.post<{ disconnected: boolean }>('/email-sync/gmail/disconnect'),

  sync: () => api.post<GmailSyncResult>('/email-sync/gmail/sync'),

  listSuggestions: () => api.get<EmailSuggestion[]>('/email-sync/suggestions'),

  getPendingCount: () => api.get<{ count: number }>('/email-sync/pending-count'),

  confirmSuggestion: (id: string, overrides: SuggestionOverrides = {}) =>
    api.post<EmailSuggestion>(`/email-sync/suggestions/${id}/confirm`, overrides),

  dismissSuggestion: (id: string) => api.post<EmailSuggestion>(`/email-sync/suggestions/${id}/dismiss`),
};
