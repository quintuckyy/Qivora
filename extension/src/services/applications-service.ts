import { api } from './api-client';
import type { ExtractedJob } from '../platforms/types';

export interface CreatedApplication {
  id: string;
  company: string;
  position: string;
  status: string;
}

export interface ExistingApplicationSummary {
  id: string;
  company: string;
  position: string;
  status: string;
  createdAt: string;
}

export interface DuplicateCheckResult {
  exists: boolean;
  application: ExistingApplicationSummary | null;
}

export async function saveApplication(job: ExtractedJob, token: string): Promise<CreatedApplication> {
  return api.post<CreatedApplication>(
    '/applications',
    {
      company: job.company,
      position: job.position,
      status: 'APPLIED',
      location: job.location || undefined,
      jobUrl: job.jobUrl || undefined,
    },
    token,
  );
}

/** Job URL is the primary duplicate signal — scoped server-side to the
 * caller, same ownership boundary as every other application query. */
export async function checkDuplicate(jobUrl: string, token: string): Promise<DuplicateCheckResult> {
  const params = new URLSearchParams({ jobUrl });
  return api.get<DuplicateCheckResult>(`/applications/check-duplicate?${params.toString()}`, token);
}
