import { linkedInProvider } from './linkedin';

describe('linkedInProvider', () => {
  describe('matches', () => {
    it('matches a linkedin.com sender', () => {
      expect(linkedInProvider.matches({ subject: '', bodyText: '', from: 'jobs-noreply@linkedin.com' })).toBe(
        true,
      );
    });

    it('does not match an unrelated sender even if it mentions LinkedIn in the body', () => {
      expect(
        linkedInProvider.matches({
          subject: '',
          bodyText: 'Found via LinkedIn',
          from: 'careers@acmerobotics.com',
        }),
      ).toBe(false);
    });
  });

  describe('extract', () => {
    // Regression: a real LinkedIn confirmation email's subject only ever
    // names the company ("Your application was sent to SGV & Co.") — the
    // position lives in a separate "job card" block in the body, which the
    // old patterns (all requiring a "you applied for X at Y"-style single
    // sentence) never looked for at all, leaving position permanently blank.
    it('parses the position from the "job card" block below the confirmation line', () => {
      const result = linkedInProvider.extract({
        subject: 'Quinn, your application was sent to SGV & Co.',
        bodyText: 'Associate Full Stack Developer \n SGV & Co. · Makati (Hybrid)\n \n Applied on August 28, 2026',
        from: 'jobs-noreply@linkedin.com',
      });

      expect(result.position).toBe('Associate Full Stack Developer');
      expect(result.company).toBe('SGV & Co');
    });

    // Regression: the same real email's *plain-text* part (once properly
    // quoted-printable decoded — see gmail-message.parser.spec.ts) has no
    // "·" separator at all: position, company, and location are three
    // bare consecutive lines.
    it('parses the "job card" from the plain-text part, which has no "·" separator', () => {
      const result = linkedInProvider.extract({
        subject: 'Quinn, your application was sent to Aventis Technology',
        bodyText: 'Associate – CVM Support & Development\nAventis Technology\nPasig\nView job: https://…',
        from: 'jobs-noreply@linkedin.com',
      });

      expect(result.position).toBe('Associate – CVM Support & Development');
      expect(result.company).toBe('Aventis Technology');
    });

    it('parses "You applied for <position> at <company>"', () => {
      const result = linkedInProvider.extract({
        subject: 'Application sent',
        bodyText: 'You applied for Full Stack Developer at Acme Robotics.',
        from: 'jobs-noreply@linkedin.com',
      });

      expect(result.position).toBe('Full Stack Developer');
      expect(result.company).toBe('Acme Robotics');
    });

    it('parses "<company> viewed your application for <position>"', () => {
      const result = linkedInProvider.extract({
        subject: 'Your application was viewed',
        bodyText: 'Acme Robotics viewed your application for Full Stack Developer.',
        from: 'jobs-noreply@linkedin.com',
      });

      expect(result.position).toBe('Full Stack Developer');
      expect(result.company).toBe('Acme Robotics');
    });

    it('parses "Your application was sent to <company>" (company only)', () => {
      const result = linkedInProvider.extract({
        subject: 'Your application was sent to Acme Robotics',
        bodyText: 'Good luck!',
        from: 'jobs-noreply@linkedin.com',
      });

      expect(result.company).toBe('Acme Robotics');
      expect(result.position).toBeNull();
    });

    it('returns nulls rather than guessing on unrecognized phrasing', () => {
      const result = linkedInProvider.extract({
        subject: 'Weekly job digest',
        bodyText: 'Here are jobs based on your profile.',
        from: 'jobs-noreply@linkedin.com',
      });

      expect(result.position).toBeNull();
      expect(result.company).toBeNull();
    });
  });
});
