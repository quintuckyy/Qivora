import { genericProvider } from './generic';

describe('genericProvider', () => {
  it('always matches (it is the fallback of last resort)', () => {
    expect(genericProvider.matches({ subject: '', bodyText: '', from: 'anyone@example.com' })).toBe(true);
  });

  describe('extract — direct recruiter/company emails', () => {
    it('parses "for the <position> position at <company>"', () => {
      const result = genericProvider.extract({
        subject: 'Your application to Acme Robotics has been received',
        bodyText: 'Thank you for applying to the Senior Backend Engineer position at Acme Robotics.',
        from: '"Acme Robotics Recruiting" <careers@acmerobotics.com>',
      });

      expect(result.position).toBe('Senior Backend Engineer');
      expect(result.company).toBe('Acme Robotics');
    });

    it('parses "position of <position> at <company>"', () => {
      const result = genericProvider.extract({
        subject: 'Job Offer',
        bodyText: 'We are pleased to offer you the position of Senior Backend Engineer at Acme Robotics.',
        from: 'talent@acmerobotics.com',
      });

      expect(result.position).toBe('Senior Backend Engineer');
      expect(result.company).toBe('Acme Robotics');
    });

    it('parses a company-only "thank you for applying to <company>"', () => {
      const result = genericProvider.extract({
        subject: 'Thank you for applying',
        bodyText: 'Thank you for applying to Nimbus Cloud. We will be in touch.',
        from: 'hr@nimbuscloud.com',
      });

      expect(result.company).toBe('Nimbus Cloud');
      expect(result.position).toBeNull();
    });

    it('handles a position containing a comma and a company with an Inc. suffix', () => {
      const result = genericProvider.extract({
        subject: 'Thank you for applying',
        bodyText: 'Thank you for applying to the Software Engineer, Backend position at Nimbus Cloud Inc.',
        from: 'hr@nimbuscloud.com',
      });

      expect(result.position).toBe('Software Engineer, Backend');
      expect(result.company).toBe('Nimbus Cloud Inc');
    });
  });

  describe('extract — malformed/ambiguous emails', () => {
    it('returns nulls instead of guessing when no recognizable phrasing is present', () => {
      const result = genericProvider.extract({
        subject: 'Application Update',
        bodyText:
          'Thanks for reaching out! We wanted to let you know things are moving along nicely between our ' +
          'teams and everyone is excited about next steps regarding your recent submission.',
        from: 'notifications@mail.example.com',
      });

      expect(result.position).toBeNull();
      expect(result.company).toBeNull();
    });

    it('never throws on an empty message', () => {
      expect(() => genericProvider.extract({ subject: '', bodyText: '', from: '' })).not.toThrow();
      const result = genericProvider.extract({ subject: '', bodyText: '', from: '' });
      expect(result.position).toBeNull();
      expect(result.company).toBeNull();
      expect(result.applicationDate).toBeNull();
    });

    it('strips boilerplate footer text before matching, so it cannot be mistaken for a company mention', () => {
      const result = genericProvider.extract({
        subject: 'Thank you for applying',
        bodyText:
          'Thank you for applying to Nimbus Cloud.\n\n' +
          'This is an automated message, please do not reply to this email.\n' +
          "You're receiving this email because you applied on our careers site.\n" +
          '© 2026 Nimbus Cloud. All rights reserved.',
        from: 'hr@nimbuscloud.com',
      });

      expect(result.company).toBe('Nimbus Cloud');
    });
  });
});
