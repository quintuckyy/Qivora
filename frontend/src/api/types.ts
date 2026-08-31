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
  /** Display-only origin label (e.g. "EMAIL_SYNC", "MANUAL"); null when unknown. */
  source: string | null;
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

export type DetectedEmailType =
  | 'APPLICATION_RECEIVED'
  | 'ASSESSMENT'
  | 'INTERVIEW'
  | 'REJECTION'
  | 'OFFER'
  | 'OTHER';

export type SuggestedAction = 'CREATE_APPLICATION' | 'UPDATE_STATUS' | 'NONE';

export interface GmailStatus {
  connected: boolean;
  email: string | null;
  lastSyncedAt: string | null;
  nextSyncAvailableAt: string | null;
}

export interface GmailSyncResult {
  scanned: number;
  newlyProcessed: number;
  suggestionsCreated: number;
  autoDismissed: number;
}

export interface MatchedApplicationSummary {
  id: string;
  company: string;
  position: string;
  status: ApplicationStatus;
}

export interface EmailSuggestion {
  id: string;
  subject: string | null;
  fromAddress: string | null;
  receivedAt: string | null;
  detectedType: DetectedEmailType;
  confidence: number;
  extractedCompany: string | null;
  extractedPosition: string | null;
  extractedSource: string | null;
  suggestedAction: SuggestedAction;
  matchedApplicationId: string | null;
  matchedApplication: MatchedApplicationSummary | null;
  createdAt: string;
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
