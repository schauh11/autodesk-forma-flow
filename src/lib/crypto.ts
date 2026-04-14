import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param plaintext The string to encrypt
 * @param keyHex The encryption key as a 64-character hex string (32 bytes)
 * @returns Object containing ciphertext (with auth tag appended) and IV
 */
export function encryptToken(plaintext: string, keyHex: string): { ciphertext: Buffer; iv: Buffer } {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 64 hex characters (32 bytes)');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return {
    ciphertext: encrypted,
    iv,
  };
}

/**
 * Decrypts a ciphertext buffer using AES-256-GCM.
 * @param ciphertext The encrypted data with auth tag appended
 * @param iv The initialization vector used during encryption
 * @param keyHex The encryption key as a 64-character hex string (32 bytes)
 * @returns The decrypted plaintext string
 * @throws Error if auth tag verification fails (tampering detected)
 */
export function decryptToken(ciphertext: Buffer, iv: Buffer, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be 64 hex characters (32 bytes)');
  }

  if (ciphertext.length < AUTH_TAG_LENGTH) {
    throw new Error('Invalid ciphertext: too short to contain auth tag');
  }

  const authTag = ciphertext.slice(-AUTH_TAG_LENGTH);
  const encryptedData = ciphertext.slice(0, ciphertext.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error('Authentication tag verification failed - ciphertext may have been tampered with');
  }
}
