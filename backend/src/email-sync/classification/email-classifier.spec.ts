import { classifyEmail } from './email-classifier';

describe('classifyEmail', () => {
  it('detects an application-received email and extracts company/position', () => {
    const result = classifyEmail({
      subject: 'Your application to Acme Robotics has been received',
      bodyText:
        'Hi Jordan,\n\nThank you for applying to the Senior Backend Engineer position at Acme Robotics. ' +
        'We have received your application and our team will review it shortly.\n\nBest,\nAcme Robotics Recruiting Team',
      from: '"Acme Robotics Recruiting" <careers@acmerobotics.com>',
    });

    expect(result.type).toBe('APPLICATION_RECEIVED');
    expect(result.company).toBe('Acme Robotics');
    expect(result.position).toBe('Senior Backend Engineer');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.source).toBe('acmerobotics.com');
  });

  it('detects an assessment invitation', () => {
    const result = classifyEmail({
      subject: 'Next step: Coding Assessment for Senior Backend Engineer at Acme Robotics',
      bodyText:
        "Hi Jordan,\n\nAs the next step in your application for the Senior Backend Engineer role at Acme Robotics, " +
        "we'd like to invite you to complete a coding assessment. Please complete the technical test within 5 days.",
      from: 'noreply@greenhouse.io',
    });

    expect(result.type).toBe('ASSESSMENT');
    expect(result.company).toBe('Acme Robotics');
    expect(result.position).toBe('Senior Backend Engineer');
    expect(result.source).toBe('Greenhouse');
  });

  it('detects an interview invitation', () => {
    const result = classifyEmail({
      subject: 'Interview invitation: Senior Backend Engineer at Acme Robotics',
      bodyText:
        'Hi Jordan,\n\nWe were impressed by your application and would like to invite you to an interview ' +
        'for the Senior Backend Engineer position at Acme Robotics. Please pick a time to schedule your interview.',
      from: 'talent@acmerobotics.com',
    });

    expect(result.type).toBe('INTERVIEW');
    expect(result.company).toBe('Acme Robotics');
    expect(result.position).toBe('Senior Backend Engineer');
  });

  it('detects a rejection even though it also thanks the applicant', () => {
    const result = classifyEmail({
      subject: 'Update on your application to Acme Robotics',
      bodyText:
        'Hi Jordan,\n\nThank you for your interest in Acme Robotics and for taking the time to interview with us. ' +
        'After careful consideration, we have decided not to move forward with your candidacy for the Senior Backend ' +
        'Engineer position at Acme Robotics. We wish you the best in your future endeavors.',
      from: 'talent@acmerobotics.com',
    });

    expect(result.type).toBe('REJECTION');
    expect(result.company).toBe('Acme Robotics');
  });

  it('detects an offer', () => {
    const result = classifyEmail({
      subject: 'Job Offer: Senior Backend Engineer at Acme Robotics',
      bodyText:
        'Hi Jordan,\n\nWe are pleased to offer you the position of Senior Backend Engineer at Acme Robotics. ' +
        'Please find attached your offer letter. Welcome to the team!',
      from: 'talent@acmerobotics.com',
    });

    expect(result.type).toBe('OFFER');
    expect(result.company).toBe('Acme Robotics');
    expect(result.position).toBe('Senior Backend Engineer');
  });

  it('classifies an unrelated email as OTHER with zero confidence and no extraction', () => {
    const result = classifyEmail({
      subject: 'Your receipt from Coffee Shop',
      bodyText: 'Thanks for your order! Your total was $4.50.',
      from: 'receipts@coffeeshop.com',
    });

    expect(result.type).toBe('OTHER');
    expect(result.confidence).toBe(0);
    expect(result.company).toBeNull();
    expect(result.position).toBeNull();
  });

  it('handles a position containing a comma and a company with an Inc. suffix', () => {
    const result = classifyEmail({
      subject: 'Thank you for applying',
      bodyText:
        'Thank you for applying to the Software Engineer, Backend position at Nimbus Cloud Inc. We have received it.',
      from: 'hr@nimbuscloud.com',
    });

    expect(result.position).toBe('Software Engineer, Backend');
    expect(result.company).toBe('Nimbus Cloud Inc');
  });

  it('falls back to the From display name when no company is found in the text', () => {
    const result = classifyEmail({
      subject: 'Interview invitation',
      bodyText: 'We would like to invite you to an interview. Please let us know your availability.',
      from: '"BrightPath Software Careers" <careers@brightpathsoftware.com>',
    });

    expect(result.type).toBe('INTERVIEW');
    expect(result.company).toBe('BrightPath Software');
  });

  it('never throws on an empty message', () => {
    expect(() => classifyEmail({ subject: '', bodyText: '', from: '' })).not.toThrow();
    const result = classifyEmail({ subject: '', bodyText: '', from: '' });
    expect(result.type).toBe('OTHER');
    expect(result.source).toBeNull();
  });

  // Regression: a real JobStreet notification with this exact subject shape
  // used to fall through every pattern and either grab nothing or, worse,
  // treat the full sentence as the company name.
  it('parses "<position> was successfully submitted to <company>" from JobStreet', () => {
    const result = classifyEmail({
      subject: 'Web Developer was successfully submitted to FilePino',
      bodyText: 'Your application has been sent. Good luck!',
      from: 'notifications@jobstreet.com.ph',
    });

    expect(result.type).toBe('APPLICATION_RECEIVED');
    expect(result.position).toBe('Web Developer');
    expect(result.company).toBe('FilePino');
    expect(result.source).toBe('JobStreet');
  });

  it('parses a real LinkedIn confirmation email\'s "job card" position, separate from the company-only subject', () => {
    const result = classifyEmail({
      subject: 'Quinn, your application was sent to SGV & Co.',
      bodyText: 'Associate Full Stack Developer \n SGV & Co. · Makati (Hybrid)\n \n Applied on August 28, 2026',
      from: 'LinkedIn <jobs-noreply@linkedin.com>',
    });

    expect(result.position).toBe('Associate Full Stack Developer');
    expect(result.company).toBe('SGV & Co');
    expect(result.source).toBe('LinkedIn');
  });

  it('routes a linkedin.com email to the LinkedIn provider as the source', () => {
    const result = classifyEmail({
      subject: 'Your application was sent to Acme Robotics',
      bodyText: 'You applied for Full Stack Developer at Acme Robotics.',
      from: 'jobs-noreply@linkedin.com',
    });

    expect(result.position).toBe('Full Stack Developer');
    expect(result.company).toBe('Acme Robotics');
    expect(result.source).toBe('LinkedIn');
  });

  it('routes an indeed.com email to the Indeed provider as the source', () => {
    const result = classifyEmail({
      subject: 'Indeed Application: Full Stack Developer',
      bodyText: 'Your application was submitted to Acme Robotics.',
      from: 'invite@indeed.com',
    });

    expect(result.position).toBe('Full Stack Developer');
    expect(result.company).toBe('Acme Robotics');
    expect(result.source).toBe('Indeed');
  });

  // A rejection routed through JobStreet/Indeed: neither provider's own
  // patterns cover rejection phrasing (only their success-confirmation
  // templates), so extraction should fall back to the generic patterns
  // while `source` still correctly attributes to the platform via its
  // domain match — provider-specific parsing is tried first, generic
  // fallback fills in the rest, exactly as for every other email type.
  it('detects a rejection routed through JobStreet and still attributes the source correctly', () => {
    const result = classifyEmail({
      subject: 'Application update',
      bodyText:
        'Thank you for your interest in the QA Engineer position at Acme Robotics in Cebu City. ' +
        'Unfortunately, we will not be moving forward with your application.',
      from: 'notifications@jobstreet.com.ph',
    });

    expect(result.type).toBe('REJECTION');
    expect(result.position).toBe('QA Engineer');
    expect(result.company).toBe('Acme Robotics');
    expect(result.source).toBe('JobStreet');
  });

  it('detects a rejection routed through Indeed and still attributes the source correctly', () => {
    const result = classifyEmail({
      subject: 'Application update',
      bodyText:
        'Thank you for your interest in the QA Engineer position at Acme Robotics in Cebu City. ' +
        'Unfortunately, we will not be moving forward with your application.',
      from: 'invite@indeed.com',
    });

    expect(result.type).toBe('REJECTION');
    expect(result.position).toBe('QA Engineer');
    expect(result.company).toBe('Acme Robotics');
    expect(result.source).toBe('Indeed');
  });

  it('does not guess a company/position from a vague, ambiguous email instead of leaving them blank', () => {
    const result = classifyEmail({
      subject: 'Application Update',
      bodyText:
        'Thank you for applying! We have received your application and appreciate your interest. ' +
        'Our team will review things and get back to you regarding next steps.',
      from: 'notifications@mail.example.com',
    });

    expect(result.type).toBe('APPLICATION_RECEIVED');
    expect(result.position).toBeNull();
    expect(result.company).toBeNull();
  });

  it('extracts an explicitly stated application date', () => {
    const result = classifyEmail({
      subject: 'Web Developer was successfully submitted to FilePino',
      bodyText: 'You applied on August 20, 2026. Good luck!',
      from: 'notifications@jobstreet.com.ph',
    });

    expect(result.applicationDate).toEqual(new Date('August 20, 2026'));
  });

  it('leaves applicationDate null when no date is stated in the email', () => {
    const result = classifyEmail({
      subject: 'Your application to Acme Robotics has been received',
      bodyText: 'Thank you for applying to the Senior Backend Engineer position at Acme Robotics.',
      from: '"Acme Robotics Recruiting" <careers@acmerobotics.com>',
    });

    expect(result.applicationDate).toBeNull();
  });

  // Regression: a real LinkedIn-relayed rejection email from Careernet. The
  // rejection sentence itself ("Thank you for your interest in the X
  // position at Y...") lives below LinkedIn's own "job card" block (position
  // on one line, "Company · Location" on the next) — that job card is what
  // actually supplies position/company here, via LinkedIn's existing
  // extraction pattern, not the rejection sentence.
  it('detects a LinkedIn-relayed rejection and extracts position/company from the job card', () => {
    const result = classifyEmail({
      subject: 'Your update from Careernet',
      bodyText:
        'Your update from Careernet\n\n' +
        'Channel Specialist – Direct Marketing (Offshore)\n' +
        'Careernet · Noida, Uttar Pradesh, India\n' +
        'Applied on Jul 22\n\n' +
        'Thank you for your interest in the Channel Specialist – Direct Marketing (Offshore) position at Careernet ' +
        'in Noida, Uttar Pradesh, India. Unfortunately, we will not be moving forward with your application, but ' +
        'we appreciate your time and interest in Careernet.\n\n' +
        'Regards,\nCareernet',
      from: 'jobs-noreply@linkedin.com',
    });

    expect(result.type).toBe('REJECTION');
    expect(result.position).toBe('Channel Specialist – Direct Marketing (Offshore)');
    expect(result.company).toBe('Careernet');
    expect(result.source).toBe('LinkedIn');
  });

  // Regression: a real JobStreet rejection ("VidaXL Services (PH) Inc.",
  // decoded from its actual quoted-printable MIME source) surfaced two
  // separate gaps: (1) it used "job" instead of "position"/"role" in its
  // opener, which the extraction pattern didn't recognize and fell through
  // to a looser pattern that over-captured "Thank you for your interest in
  // the AI Prompter job" as the whole position, breaking the match against
  // the existing tracked application entirely; and (2), once that was
  // fixed, its actual rejection phrasing — "is unlikely to progress
  // further" / "it looks unlikely that your application will progress
  // further" — didn't match any TYPE_RULES keyword, so it classified as
  // APPLICATION_RECEIVED (weak "your application for" signal) instead of
  // REJECTION.
  it('detects a real JobStreet rejection using "job" and "unlikely to progress" phrasing', () => {
    const result = classifyEmail({
      subject: 'Application update for AI Prompter at VidaXL Services (PH) Inc.',
      bodyText:
        'Hi Quinn, it appears your application for AI Prompter advertised by VidaXL Services (PH) Inc. is ' +
        'unlikely to progress further\n\n' +
        'Hi Quinn,\n' +
        'Thank you for your interest in the AI Prompter job at VidaXL Services (PH) Inc..\n' +
        'Unfortunately, it looks unlikely that your application will progress further.\n' +
        'You may or may not still hear back from the employer.\n\n' +
        'AI Prompter\nVidaXL Services (PH) Inc.',
      from: 'Jobstreet Applications <noreply@e.jobstreet.com>',
    });

    expect(result.type).toBe('REJECTION');
    expect(result.position).toBe('AI Prompter');
    expect(result.company).toBe('VidaXL Services (PH) Inc');
    expect(result.source).toBe('JobStreet');
  });

  // Regression: a direct recruiter/company rejection with no job-card block
  // at all — nothing but the "thank you for your interest..." paragraph —
  // exercising the generic-provider fallback pattern added for this shape.
  it('detects a direct recruiter rejection with no job card, via the generic fallback', () => {
    const result = classifyEmail({
      subject: 'Update on your application',
      bodyText:
        'Hi Jordan,\n\nThank you for your interest in the Senior Backend Engineer position at Acme Robotics in ' +
        'Austin, TX. Unfortunately, we will not be moving forward with your application at this time. ' +
        'We wish you the best in your job search.\n\nBest,\nAcme Robotics Talent Team',
      from: 'talent@acmerobotics.com',
    });

    expect(result.type).toBe('REJECTION');
    expect(result.position).toBe('Senior Backend Engineer');
    expect(result.company).toBe('Acme Robotics');
  });

  it('detects "your application was unsuccessful" as a rejection', () => {
    const result = classifyEmail({
      subject: 'Application update',
      bodyText: 'Your application for the Backend Engineer role at Acme Robotics was unsuccessful this time around.',
      from: 'talent@acmerobotics.com',
    });

    expect(result.type).toBe('REJECTION');
  });

  it('detects "we will not proceed with your application" as a rejection', () => {
    const result = classifyEmail({
      subject: 'Application update',
      bodyText: 'After review, we will not proceed with your application for the Backend Engineer role.',
      from: 'talent@acmerobotics.com',
    });

    expect(result.type).toBe('REJECTION');
  });

  // Regression: "unfortunately" is common in email that has nothing to do
  // with a job application at all — it must never, by itself, be enough to
  // tag an unrelated email as a rejection.
  it('does not classify an unrelated email containing "unfortunately" as a rejection', () => {
    const result = classifyEmail({
      subject: 'Office closure notice',
      bodyText: 'Unfortunately, our office will be closed this Friday for a company event. Thanks for your patience.',
      from: 'admin@somecompany.com',
    });

    expect(result.type).toBe('OTHER');
    expect(result.confidence).toBe(0);
  });

  // Regression: JobStreet's "this listing has expired" nudge recaps the job
  // ("the Programmer job you applied for...") purely to identify it, not to
  // report a status change — it must not trip APPLICATION_RECEIVED and
  // generate a bogus "new application" suggestion for one that already exists.
  it('does not classify a job-listing-expired notification as an application update', () => {
    const result = classifyEmail({
      subject: 'A job you applied for has expired',
      bodyText:
        'Hi Quinn,\n\nThe Programmer job you applied for at Asticom Technology Inc has now expired on Jobstreet ' +
        'and is no longer taking applications. Rest assured, the employer has your application and you may still ' +
        'hear back from them.\n\nKeep track of your applied jobs and discover more below.',
      from: 'noreply@jobstreet.com',
    });

    expect(result.type).toBe('OTHER');
    expect(result.confidence).toBe(0);
  });

  // Regression: LeetCode's routine "Weekly Digest" marketing email plugs its
  // own Daily Coding Challenge feature — matching ASSESSMENT's "coding
  // challenge" phrase with zero application context. It must not surface as
  // a bogus assessment invitation for a job that was never applied to.
  it('does not classify a LeetCode marketing digest as an assessment invitation', () => {
    const result = classifyEmail({
      subject: 'LeetCode Weekly Digest',
      bodyText:
        'Hi LeetCoder!\n\nLooking to sharpen your coding game? Our Back-to-School promotion is on, offering the ' +
        "perfect boost to your prep routine. It's your chance to get LeetCode premium for $60 off, learn smarter, " +
        'train harder, and become the "leet" one in your class. Check out this post for details.\n\n' +
        "Don't forget to join us for the Daily LeetCoding Challenge, as you could earn a badge for completing the " +
        'daily coding challenge for the month. Happy LeetCoding!\n\nTop Picks For You',
      from: 'LeetCode <no-reply@leetcode.com>',
    });

    expect(result.type).toBe('OTHER');
    expect(result.confidence).toBe(0);
  });
});
