import { encryptToken, decryptToken } from './encryption';

describe('encryption', () => {
  const originalEnv = process.env.EMAIL_SYNC_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.EMAIL_SYNC_ENCRYPTION_KEY = 'test-encryption-key-do-not-use-in-prod';
  });

  afterAll(() => {
    process.env.EMAIL_SYNC_ENCRYPTION_KEY = originalEnv;
  });

  it('round-trips a token through encrypt then decrypt', () => {
    const token = 'ya29.a0Af-fake-gmail-access-token';
    const encrypted = encryptToken(token);

    expect(encrypted).not.toBe(token);
    expect(decryptToken(encrypted)).toBe(token);
  });

  it('produces a different ciphertext each time (random IV) for the same plaintext', () => {
    const token = 'same-token-value';
    expect(encryptToken(token)).not.toBe(encryptToken(token));
  });

  it('throws when EMAIL_SYNC_ENCRYPTION_KEY is not set', () => {
    delete process.env.EMAIL_SYNC_ENCRYPTION_KEY;
    expect(() => encryptToken('anything')).toThrow(/EMAIL_SYNC_ENCRYPTION_KEY/);
  });

  it('throws on a tampered ciphertext instead of returning garbage', () => {
    const encrypted = encryptToken('a-real-token');
    const [iv, authTag, body] = encrypted.split('.');
    const tampered = [iv, authTag, Buffer.from('tampered-payload').toString('base64')].join('.');

    expect(() => decryptToken(tampered)).toThrow();
    expect(iv && authTag && body).toBeTruthy();
  });

  it('throws on a malformed ciphertext string', () => {
    expect(() => decryptToken('not-the-right-shape')).toThrow(/Malformed/);
  });
});
