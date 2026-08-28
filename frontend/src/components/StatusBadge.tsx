import type { ApplicationStatus } from '../api/types';

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>;
}
