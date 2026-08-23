import type { ApplicationStatus } from '../api/types';

const LABELS: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{LABELS[status]}</span>;
}
