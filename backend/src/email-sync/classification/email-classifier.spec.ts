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
});
