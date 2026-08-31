import { API_BASE_URL, ApiError, api } from './client';
import type { Resume } from './types';

export const resumesApi = {
  list: () => api.get<Resume[]>('/resumes'),

  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.postForm<Resume>('/resumes', formData);
  },

  rename: (id: string, name: string) =>
    api.patch<Resume>(`/resumes/${id}`, { name }),

  setDefault: (id: string) => api.patch<Resume>(`/resumes/${id}/default`),

  remove: (id: string) => api.delete<{ message: string }>(`/resumes/${id}`),

  /**
   * Downloads use a fetch + blob flow (not a plain <a href>) because the endpoint
   * requires a Bearer token, which a normal browser navigation can't attach.
   */
  download: async (resume: Resume, token: string | null): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/resumes/${resume.id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to download resume.');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = resume.originalName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  /**
   * Fetches the raw file (same token constraint as download) and returns a blob
   * object URL the caller renders in an <iframe>. Caller is responsible for
   * revoking the URL when the preview closes.
   */
  previewObjectUrl: async (resumeId: string, token: string | null): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/resumes/${resumeId}/preview`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to load resume preview.');
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },
};
