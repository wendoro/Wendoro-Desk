import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const SALT = 'wendoro-erp-credential-vault-v1';

function deriveAesKey(secret: string): Buffer {
  if (!secret || secret.trim().length < 16 || secret.includes('REPLACE_WITH')) {
    throw new Error(
      'BETTER_AUTH_SECRET must be set to at least 16 characters to encrypt or decrypt integration credentials.',
    );
  }
  return scryptSync(secret, SALT, 32);
}

/**
 * Encrypts sensitive integration credentials (e.g., OAuth tokens, SMTP passwords,
 * webhook secrets) using AES-256-GCM before storing in `integrations.encrypted_credentials`.
 */
export function encryptCredential(plaintext: string, secret: string): string {
  const key = deriveAesKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptCredential(payload: string, secret: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Unsupported encrypted credential payload format.');
  }
  const key = deriveAesKey(secret);
  const iv = Buffer.from(parts[1], 'base64');
  const authTag = Buffer.from(parts[2], 'base64');
  const ciphertext = Buffer.from(parts[3], 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
