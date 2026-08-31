import { api } from './client';
import type {
  ApplicationHistoryEntry,
  ApplicationStatus,
  JobApplication,
  PaginatedApplications,
  StatisticsResponse,
} from './types';

export interface ApplicationsQuery {
  page: number;
  limit: number;
  search?: string;
  status?: ApplicationStatus | '';
  /** Filter by résumé assignment: `false` = only applications missing a résumé. */
  hasResume?: boolean;
  /** Filter to applications assigned this specific résumé version. */
  resumeId?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export type ApplicationSource = 'LINKEDIN' | 'JOBSTREET' | 'INDEED' | 'EMAIL_SYNC' | 'MANUAL';

export interface CreateApplicationPayload {
  company: string;
  position: string;
  status?: ApplicationStatus;
  salaryMin?: number;
  salaryMax?: number;
  location?: string;
  jobUrl?: string;
  source?: ApplicationSource;
}

export type UpdateApplicationPayload = Partial<CreateApplicationPayload>;

function buildQueryString(query: ApplicationsQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('limit', String(query.limit));
  params.set('sortBy', query.sortBy);
  params.set('sortOrder', query.sortOrder);
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  if (query.hasResume !== undefined) params.set('hasResume', String(query.hasResume));
  if (query.resumeId) params.set('resumeId', query.resumeId);
  return params.toString();
}

export const applicationsApi = {
  list: (query: ApplicationsQuery) =>
    api.get<PaginatedApplications>(`/applications?${buildQueryString(query)}`),

  get: (id: string) => api.get<JobApplication>(`/applications/${id}`),

  create: (payload: CreateApplicationPayload) =>
    api.post<JobApplication>('/applications', payload),

  update: (id: string, payload: UpdateApplicationPayload) =>
    api.patch<JobApplication>(`/applications/${id}`, payload),

  remove: (id: string) => api.delete<JobApplication>(`/applications/${id}`),

  updateStatus: (id: string, status: ApplicationStatus) =>
    api.patch<JobApplication>(`/applications/${id}/status`, { status }),

  assignResume: (id: string, resumeId: string) =>
    api.patch<JobApplication>(`/applications/${id}/resume`, { resumeId }),

  history: (id: string) =>
    api.get<ApplicationHistoryEntry[]>(`/applications/${id}/history`),

  statistics: () => api.get<StatisticsResponse>('/applications/statistics'),
};
