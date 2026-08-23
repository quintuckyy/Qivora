import { matchApplication, statusForDetectedType, type MatchCandidate } from './application-matcher';
import { ApplicationStatus } from '../../generated/prisma/enums';

const candidate = (overrides: Partial<MatchCandidate> = {}): MatchCandidate => ({
  id: 'app-1',
  company: 'Acme Robotics',
  position: 'Senior Backend Engineer',
  status: ApplicationStatus.APPLIED,
  ...overrides,
});

describe('matchApplication', () => {
  it('suggests creating a new application when APPLICATION_RECEIVED has no company match', () => {
    const result = matchApplication(
      { type: 'APPLICATION_RECEIVED', company: 'Nimbus Cloud', position: 'Data Analyst' },
      [],
    );

    expect(result).toEqual({ matchedApplicationId: null, suggestedAction: 'CREATE_APPLICATION', targetStatus: 'APPLIED' });
  });

  it('does not suggest creating a new application for a later-stage email with no match', () => {
    const result = matchApplication({ type: 'INTERVIEW', company: 'Nimbus Cloud', position: 'Data Analyst' }, []);

    expect(result.suggestedAction).toBe('NONE');
    expect(result.matchedApplicationId).toBeNull();
  });

  it('matches by company and suggests a forward status update', () => {
    const result = matchApplication(
      { type: 'INTERVIEW', company: 'Acme Robotics', position: 'Senior Backend Engineer' },
      [candidate({ status: ApplicationStatus.ASSESSMENT })],
    );

    expect(result).toEqual({ matchedApplicationId: 'app-1', suggestedAction: 'UPDATE_STATUS', targetStatus: 'INTERVIEW' });
  });

  it('matches company names loosely (suffix differences, case)', () => {
    const result = matchApplication(
      { type: 'OFFER', company: 'acme robotics inc.', position: null },
      [candidate({ status: ApplicationStatus.INTERVIEW })],
    );

    expect(result.matchedApplicationId).toBe('app-1');
    expect(result.suggestedAction).toBe('UPDATE_STATUS');
  });

  it('does not suggest an update when the target status is not a forward move', () => {
    const result = matchApplication(
      { type: 'ASSESSMENT', company: 'Acme Robotics', position: 'Senior Backend Engineer' },
      [candidate({ status: ApplicationStatus.OFFER })],
    );

    expect(result.suggestedAction).toBe('NONE');
    expect(result.matchedApplicationId).toBe('app-1');
  });

  it('does not suggest an update when the application is already at the target status', () => {
    const result = matchApplication(
      { type: 'APPLICATION_RECEIVED', company: 'Acme Robotics', position: 'Senior Backend Engineer' },
      [candidate({ status: ApplicationStatus.APPLIED })],
    );

    expect(result.suggestedAction).toBe('NONE');
  });

  it('allows moving to REJECTED from any non-terminal status', () => {
    const result = matchApplication(
      { type: 'REJECTION', company: 'Acme Robotics', position: null },
      [candidate({ status: ApplicationStatus.OFFER })],
    );

    expect(result.suggestedAction).toBe('UPDATE_STATUS');
    expect(result.targetStatus).toBe('REJECTED');
  });

  it('never suggests moving away from a REJECTED application', () => {
    const result = matchApplication(
      { type: 'INTERVIEW', company: 'Acme Robotics', position: null },
      [candidate({ status: ApplicationStatus.REJECTED })],
    );

    expect(result.suggestedAction).toBe('NONE');
  });

  it('prefers the candidate whose position also matches when multiple applications share a company', () => {
    const other = candidate({ id: 'app-2', position: 'Product Manager', status: ApplicationStatus.APPLIED });
    const target = candidate({ id: 'app-1', position: 'Senior Backend Engineer', status: ApplicationStatus.APPLIED });

    const result = matchApplication(
      { type: 'INTERVIEW', company: 'Acme Robotics', position: 'Senior Backend Engineer' },
      [other, target],
    );

    expect(result.matchedApplicationId).toBe('app-1');
  });

  it('returns NONE with no match when the email has no extractable company', () => {
    const result = matchApplication({ type: 'INTERVIEW', company: null, position: null }, [candidate()]);
    expect(result).toEqual({ matchedApplicationId: null, suggestedAction: 'NONE', targetStatus: 'INTERVIEW' });
  });

  it('returns NONE for an OTHER-classified email regardless of candidates', () => {
    const result = matchApplication({ type: 'OTHER', company: 'Acme Robotics', position: null }, [candidate()]);
    expect(result).toEqual({ matchedApplicationId: null, suggestedAction: 'NONE', targetStatus: null });
  });
});

describe('statusForDetectedType', () => {
  it('maps every detected type to its corresponding application status', () => {
    expect(statusForDetectedType('APPLICATION_RECEIVED')).toBe(ApplicationStatus.APPLIED);
    expect(statusForDetectedType('ASSESSMENT')).toBe(ApplicationStatus.ASSESSMENT);
    expect(statusForDetectedType('INTERVIEW')).toBe(ApplicationStatus.INTERVIEW);
    expect(statusForDetectedType('REJECTION')).toBe(ApplicationStatus.REJECTED);
    expect(statusForDetectedType('OFFER')).toBe(ApplicationStatus.OFFER);
  });
});
