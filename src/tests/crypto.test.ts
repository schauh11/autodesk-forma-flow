import { encryptToken, decryptToken } from '@/lib/crypto';

const TEST_KEY = 'a'.repeat(64); // valid 64-char hex string

describe('crypto', () => {
  it('should encrypt and decrypt a token round-trip', () => {
    const plaintext = 'my-secret-refresh-token-12345';
    const { ciphertext, iv } = encryptToken(plaintext, TEST_KEY);
    const decrypted = decryptToken(ciphertext, iv, TEST_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce unique IV for each encryption', () => {
    const plaintext = 'same-token';
    const result1 = encryptToken(plaintext, TEST_KEY);
    const result2 = encryptToken(plaintext, TEST_KEY);
    expect(result1.iv.equals(result2.iv)).toBe(false);
  });

  it('should detect tampering with ciphertext', () => {
    const plaintext = 'my-secret-token';
    const { ciphertext, iv } = encryptToken(plaintext, TEST_KEY);
    // Tamper with a byte in the middle of the ciphertext
    ciphertext[0] = ciphertext[0]! ^ 0xff;
    expect(() => decryptToken(ciphertext, iv, TEST_KEY)).toThrow();
  });

  it('should handle empty string encryption', () => {
    const plaintext = '';
    const { ciphertext, iv } = encryptToken(plaintext, TEST_KEY);
    const decrypted = decryptToken(ciphertext, iv, TEST_KEY);
    expect(decrypted).toBe('');
  });

  it('should reject invalid key length', () => {
    expect(() => encryptToken('test', 'tooshort')).toThrow('64 hex characters');
    expect(() => decryptToken(Buffer.alloc(32), Buffer.alloc(16), 'tooshort')).toThrow('64 hex characters');
  });
});
