import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/** Derives a stable 32-byte key from EMAIL_SYNC_ENCRYPTION_KEY so operators
 * can set a plain passphrase rather than having to generate raw key bytes. */
function deriveKey(): Buffer {
  const secret = process.env.EMAIL_SYNC_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('EMAIL_SYNC_ENCRYPTION_KEY is not set — required to store Gmail OAuth tokens.');
  }
  return scryptSync(secret, 'email-sync-token-encryption', 32);
}

/** Encrypts a Gmail OAuth token for storage. Never store these tokens in
 * plaintext — they grant read access to the user's inbox until revoked. */
export function encryptToken(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((buf) => buf.toString('base64')).join('.');
}

export function decryptToken(ciphertext: string): string {
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split('.');
  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error('Malformed encrypted token.');
  }

  const key = deriveKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return decrypted.toString('utf-8');
}
