import { jobStreetProvider } from './jobstreet';

describe('jobStreetProvider', () => {
  describe('matches', () => {
    it('matches a jobstreet.com.ph sender', () => {
      expect(
        jobStreetProvider.matches({ subject: '', bodyText: '', from: 'notifications@jobstreet.com.ph' }),
      ).toBe(true);
    });

    it('matches any JobStreet market ccTLD', () => {
      for (const domain of ['jobstreet.com', 'jobstreet.com.sg', 'jobstreet.co.id']) {
        expect(jobStreetProvider.matches({ subject: '', bodyText: '', from: `no-reply@${domain}` })).toBe(true);
      }
    });

    it('matches when relayed through a generic domain but the subject names JobStreet', () => {
      expect(
        jobStreetProvider.matches({
          subject: 'Update from JobStreet',
          bodyText: '',
          from: 'notify@sendgrid.net',
        }),
      ).toBe(true);
    });

    it('does not match an unrelated sender', () => {
      expect(jobStreetProvider.matches({ subject: '', bodyText: '', from: 'careers@acmerobotics.com' })).toBe(
        false,
      );
    });
  });

  describe('extract', () => {
    it('parses "<position> was successfully submitted to <company>"', () => {
      const result = jobStreetProvider.extract({
        subject: 'Web Developer was successfully submitted to FilePino',
        bodyText: 'Your application has been sent. Good luck!',
        from: 'notifications@jobstreet.com.ph',
      });

      expect(result.position).toBe('Web Developer');
      expect(result.company).toBe('FilePino');
    });

    it('parses "Your application for <position> at <company> has been viewed"', () => {
      const result = jobStreetProvider.extract({
        subject: 'Application update',
        bodyText: 'Your application for the Senior QA Engineer role at Nimbus Cloud has been viewed by the employer.',
        from: 'notifications@jobstreet.com.ph',
      });

      expect(result.position).toBe('Senior QA Engineer');
      expect(result.company).toBe('Nimbus Cloud');
    });

    // Regression: real JobStreet "viewed" notifications are company-first
    // ("<Company> has viewed your application for <Position>"), not
    // position-first — this used to fall through to the From display name
    // ("Jobstreet Applications") instead of the real company.
    it('parses "<company> has viewed your application for <position>" (company-first)', () => {
      const result = jobStreetProvider.extract({
        subject:
          'Strategic Networks, Inc. has viewed your application for IT Junior Business Analyst (background with Programming)',
        bodyText: '',
        from: 'Jobstreet Applications <noreply@e.jobstreet.com>',
      });

      expect(result.company).toBe('Strategic Networks, Inc');
      expect(result.position).toBe('IT Junior Business Analyst (background with Programming)');
    });

    it('parses "Your application for <position> has been shortlisted by <company>"', () => {
      const result = jobStreetProvider.extract({
        subject: 'Great news!',
        bodyText: 'Your application for Backend Developer has been shortlisted by Acme Robotics.',
        from: 'notifications@jobstreet.com',
      });

      expect(result.position).toBe('Backend Developer');
      expect(result.company).toBe('Acme Robotics');
    });

    // Regression: a real JobStreet email produced position "3-months Free
    // Online Training)" instead of the full title, because the title
    // contains a literal "+" that the old character-class allow-list
    // didn't include, breaking the capture mid-string.
    it('does not truncate a position at a "+" or other punctuation the old allow-list missed', () => {
      const result = jobStreetProvider.extract({
        subject: 'Your application for Junior Developers was successfully submitted',
        bodyText:
          'Hi Quinn,\n\n' +
          'Your application for Junior Developers (With or without IT background+ 3-months Free Online Training) ' +
          'was successfully submitted to ZUITT.\n\n' +
          "Each employer's recruitment process is different, so you might not always hear from them.",
        from: 'Jobstreet Applications <noreply@e.jobstreet.com>',
      });

      expect(result.position).toBe('Junior Developers (With or without IT background+ 3-months Free Online Training)');
      expect(result.company).toBe('ZUITT');
    });

    // Regression: a real JobStreet email where the greeting and the
    // application sentence share one line with no newline between them —
    // the position capture used to swallow "Hi Quinn, your application
    // for" right along with the real title.
    it('does not swallow a same-line greeting into the position', () => {
      const result = jobStreetProvider.extract({
        subject: 'Your application was successfully submitted',
        bodyText:
          'Hi Quinn, your application for Junior Web Designer (Mid shift) was successfully submitted to TENERITY PHILIPPINES CORP.',
        from: 'Jobstreet Applications <noreply@e.jobstreet.com>',
      });

      expect(result.position).toBe('Junior Web Designer (Mid shift)');
      expect(result.company).toBe('TENERITY PHILIPPINES CORP');
    });

    // Regression: the exact stripped-HTML text produced by a real
    // "successfully submitted" confirmation email (greeting and sentence
    // on separate lines, company name ending in an abbreviation period).
    it('parses the exact text a real HTML confirmation email strips down to', () => {
      const result = jobStreetProvider.extract({
        subject: 'Your application was successfully submitted',
        bodyText: 'Hi Quinn,\n \n Your application for Junior Software Developer was successfully submitted to MACKY CHAMP SOFTWARE VENTURES INC. .',
        from: 'Jobstreet Applications <noreply@e.jobstreet.com>',
      });

      expect(result.position).toBe('Junior Software Developer');
      expect(result.company).toBe('MACKY CHAMP SOFTWARE VENTURES INC');
    });

    it('extracts an explicit application date when the email states one', () => {
      const result = jobStreetProvider.extract({
        subject: 'Web Developer was successfully submitted to FilePino',
        bodyText: 'You applied on August 20, 2026.',
        from: 'notifications@jobstreet.com.ph',
      });

      expect(result.applicationDate).toEqual(new Date('August 20, 2026'));
    });

    // Regression: a real JobStreet subject truncated the position to just
    // "Jr" — the character class was already permissive enough to include
    // periods, but the trailing boundary still stopped at the *first*
    // period it saw regardless of what followed, so "Jr./Sr." (an
    // abbreviation, not a sentence end) still cut the match short.
    it('does not truncate a position at an internal abbreviation period like "Jr./Sr."', () => {
      const result = jobStreetProvider.extract({
        subject: 'Kooapps has viewed your application for Jr./Sr. Backend Programmer (We Provide Training!)',
        bodyText: '',
        from: 'notifications@jobstreet.com.ph',
      });

      expect(result.company).toBe('Kooapps');
      expect(result.position).toBe('Jr./Sr. Backend Programmer (We Provide Training!)');
    });

    it('does not swallow a same-line greeting into the company-first "viewed" pattern', () => {
      const result = jobStreetProvider.extract({
        subject: 'Application update',
        bodyText: 'Hi Quinn, Strategic Networks, Inc. has viewed your application for IT Junior Business Analyst.',
        from: 'notifications@jobstreet.com.ph',
      });

      // normalizeEmailText strips the leading greeting outright, so this
      // correctly extracts rather than merely avoiding a wrong guess.
      expect(result.company).toBe('Strategic Networks, Inc');
      expect(result.position).toBe('IT Junior Business Analyst');
    });

    it('parses the company-first "viewed" pattern when it starts its own line', () => {
      const result = jobStreetProvider.extract({
        subject: 'Application update',
        bodyText: 'Hi Quinn,\nStrategic Networks, Inc. has viewed your application for IT Junior Business Analyst.',
        from: 'notifications@jobstreet.com.ph',
      });

      expect(result.company).toBe('Strategic Networks, Inc');
      expect(result.position).toBe('IT Junior Business Analyst');
    });

    it('returns nulls rather than guessing when the phrasing is unrecognized', () => {
      const result = jobStreetProvider.extract({
        subject: 'Job alert digest',
        bodyText: 'Here are 12 new jobs that match your search preferences this week.',
        from: 'alerts@jobstreet.com.ph',
      });

      expect(result.position).toBeNull();
      expect(result.company).toBeNull();
      expect(result.applicationDate).toBeNull();
    });
  });
});
