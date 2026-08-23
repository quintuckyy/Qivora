import { ApplicationStatus } from '../../generated/prisma/enums';
import type { DetectedEmailType } from '../classification/types';

export interface MatchCandidate {
  id: string;
  company: string;
  position: string;
  status: ApplicationStatus;
}

export type SuggestedAction = 'CREATE_APPLICATION' | 'UPDATE_STATUS' | 'NONE';

export interface MatchResult {
  matchedApplicationId: string | null;
  suggestedAction: SuggestedAction;
  targetStatus: ApplicationStatus | null;
}

const TYPE_TO_STATUS: Record<Exclude<DetectedEmailType, 'OTHER'>, ApplicationStatus> = {
  APPLICATION_RECEIVED: ApplicationStatus.APPLIED,
  ASSESSMENT: ApplicationStatus.ASSESSMENT,
  INTERVIEW: ApplicationStatus.INTERVIEW,
  REJECTION: ApplicationStatus.REJECTED,
  OFFER: ApplicationStatus.OFFER,
};

export function statusForDetectedType(type: Exclude<DetectedEmailType, 'OTHER'>): ApplicationStatus {
  return TYPE_TO_STATUS[type];
}

// Mirrors the transition rule enforced in applications.service#updateStatus
// (forward-only, REJECTED is terminal and always reachable except from
// itself) so a suggestion is never proposed that confirm-time would reject.
const STATUS_ORDER: ApplicationStatus[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.ASSESSMENT,
  ApplicationStatus.INTERVIEW,
  ApplicationStatus.OFFER,
];

function isForwardTransition(current: ApplicationStatus, target: ApplicationStatus): boolean {
  if (current === ApplicationStatus.REJECTED) return false;
  if (current === target) return false;
  if (target === ApplicationStatus.REJECTED) return true;

  const currentIndex = STATUS_ORDER.indexOf(current);
  const targetIndex = STATUS_ORDER.indexOf(target);
  return targetIndex > currentIndex;
}

const COMPANY_SUFFIXES = /\b(inc|llc|ltd|corp|corporation|co|company|plc)\b/g;

function normalizeCompany(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(COMPANY_SUFFIXES, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePosition(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function companiesMatch(a: string, b: string): boolean {
  const na = normalizeCompany(a);
  const nb = normalizeCompany(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function positionsMatch(a: string, b: string): boolean {
  const na = normalizePosition(a);
  const nb = normalizePosition(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Finds the best existing application this email likely refers to, and
 * decides whether that implies creating a new application or moving an
 * existing one forward. `candidates` should be pre-scoped to the current
 * user and ideally ordered most-recent-first, since that's the tiebreak
 * used when more than one application shares the matched company.
 */
export function matchApplication(
  detected: { type: DetectedEmailType; company: string | null; position: string | null },
  candidates: MatchCandidate[],
): MatchResult {
  if (detected.type === 'OTHER') {
    return { matchedApplicationId: null, suggestedAction: 'NONE', targetStatus: null };
  }

  const targetStatus = TYPE_TO_STATUS[detected.type];

  if (!detected.company) {
    // Nothing to safely match or create against without at least a company name.
    return { matchedApplicationId: null, suggestedAction: 'NONE', targetStatus };
  }

  const companyMatches = candidates.filter((c) => companiesMatch(c.company, detected.company as string));

  const best =
    companyMatches.length === 0
      ? null
      : detected.position
        ? (companyMatches.find((c) => positionsMatch(c.position, detected.position as string)) ?? companyMatches[0])
        : companyMatches[0];

  if (!best) {
    // Only a "your application was received" email justifies creating a
    // brand-new record from a cold match; any later-stage email (interview,
    // offer, rejection…) that doesn't match a tracked application is
    // surfaced for manual review rather than assumed to be a new one.
    if (detected.type === 'APPLICATION_RECEIVED') {
      return { matchedApplicationId: null, suggestedAction: 'CREATE_APPLICATION', targetStatus };
    }
    return { matchedApplicationId: null, suggestedAction: 'NONE', targetStatus };
  }

  if (isForwardTransition(best.status, targetStatus)) {
    return { matchedApplicationId: best.id, suggestedAction: 'UPDATE_STATUS', targetStatus };
  }

  // Matched, but the status implied by this email wouldn't be a valid move
  // (already there, or backwards) — nothing to do, matched for traceability.
  return { matchedApplicationId: best.id, suggestedAction: 'NONE', targetStatus };
}
