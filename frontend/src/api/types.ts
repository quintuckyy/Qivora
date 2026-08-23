export type Role = 'USER' | 'ADMIN';

export type ApplicationStatus =
  | 'APPLIED'
  | 'ASSESSMENT'
  | 'INTERVIEW'
  | 'OFFER'
  | 'REJECTED';

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'APPLIED',
  'ASSESSMENT',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
];

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface JobApplication {
  id: string;
  company: string;
  position: string;
  status: ApplicationStatus;
  salaryMin: number | null;
  salaryMax: number | null;
  location: string | null;
  jobUrl: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  resumeId: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedApplications {
  data: JobApplication[];
  meta: PaginationMeta;
}

export interface ApplicationHistoryEntry {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  changedAt: string;
  applicationId: string;
}

export interface Interview {
  id: string;
  title: string;
  scheduledAt: string;
  location: string | null;
  meetingUrl: string | null;
  notes: string | null;
  applicationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationNote {
  id: string;
  content: string;
  applicationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Resume {
  id: string;
  name: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  filePath: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatisticsResponse {
  totalApplications: number;
  byStatus: {
    applied: number;
    assessment: number;
    interview: number;
    offer: number;
    rejected: number;
  };
  rates: {
    assessmentRate: number;
    interviewRate: number;
    offerRate: number;
    rejectionRate: number;
    interviewToOfferRate: number;
  };
  analytics: {
    activePipeline: number;
    successfulApplications: number;
    averageApplicationsPerMonth: number;
    monthlyApplications: { month: string; count: number }[];
  };
}
