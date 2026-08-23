import { api } from './client';
import type { ApplicationNote } from './types';

export const notesApi = {
  list: (applicationId: string) =>
    api.get<ApplicationNote[]>(`/applications/${applicationId}/notes`),

  create: (applicationId: string, content: string) =>
    api.post<ApplicationNote>(`/applications/${applicationId}/notes`, { content }),

  update: (applicationId: string, noteId: string, content: string) =>
    api.patch<ApplicationNote>(`/applications/${applicationId}/notes/${noteId}`, {
      content,
    }),

  remove: (applicationId: string, noteId: string) =>
    api.delete<ApplicationNote>(`/applications/${applicationId}/notes/${noteId}`),
};
