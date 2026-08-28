import { indeedProvider } from './indeed';

describe('indeedProvider', () => {
  describe('matches', () => {
    it('matches an indeed.com sender', () => {
      expect(indeedProvider.matches({ subject: '', bodyText: '', from: 'invite@indeed.com' })).toBe(true);
    });

    it('matches a regional indeed subdomain', () => {
      expect(indeedProvider.matches({ subject: '', bodyText: '', from: 'invite@ph.indeed.com' })).toBe(true);
    });

    it('does not match an unrelated sender', () => {
      expect(indeedProvider.matches({ subject: '', bodyText: '', from: 'careers@acmerobotics.com' })).toBe(false);
    });
  });

  describe('extract', () => {
    it('parses "Application for <position> at <company> has been submitted"', () => {
      const result = indeedProvider.extract({
        subject: 'Application submitted',
        bodyText: 'Application for Full Stack Developer at Acme Robotics has been submitted.',
        from: 'invite@indeed.com',
      });

      expect(result.position).toBe('Full Stack Developer');
      expect(result.company).toBe('Acme Robotics');
    });

    it('parses "Indeed Application: <position>" from the subject (position only)', () => {
      const result = indeedProvider.extract({
        subject: 'Indeed Application: Full Stack Developer',
        bodyText: 'Your application was submitted to Acme Robotics.',
        from: 'invite@indeed.com',
      });

      expect(result.position).toBe('Full Stack Developer');
      expect(result.company).toBe('Acme Robotics');
    });

    it('parses "You applied to <company>" (company only)', () => {
      const result = indeedProvider.extract({
        subject: 'Application sent',
        bodyText: 'You applied to Acme Robotics.',
        from: 'invite@indeed.com',
      });

      expect(result.company).toBe('Acme Robotics');
    });

    it('returns nulls rather than guessing on unrecognized phrasing', () => {
      const result = indeedProvider.extract({
        subject: 'New jobs for you',
        bodyText: 'Check out these new job matches near you.',
        from: 'alerts@indeed.com',
      });

      expect(result.position).toBeNull();
      expect(result.company).toBeNull();
    });
  });
});
