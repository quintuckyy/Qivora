import { api } from './client';
import type { Interview } from './types';

export interface InterviewPayload {
  title: string;
  scheduledAt: string;
  location?: string;
  meetingUrl?: string;
  notes?: string;
}

export const interviewsApi = {
  list: (applicationId: string) =>
    api.get<Interview[]>(`/applications/${applicationId}/interviews`),

  create: (applicationId: string, payload: InterviewPayload) =>
    api.post<Interview>(`/applications/${applicationId}/interviews`, payload),

  update: (applicationId: string, interviewId: string, payload: Partial<InterviewPayload>) =>
    api.patch<Interview>(
      `/applications/${applicationId}/interviews/${interviewId}`,
      payload,
    ),

  remove: (applicationId: string, interviewId: string) =>
    api.delete<Interview>(`/applications/${applicationId}/interviews/${interviewId}`),
};
