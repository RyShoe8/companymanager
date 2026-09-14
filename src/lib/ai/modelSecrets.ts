import 'server-only';
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const explicit = process.env.AI_MODEL_SECRETS_KEY?.trim();
  if (process.env.NODE_ENV === 'production' && !explicit && !process.env.NEXTAUTH_SECRET?.trim()) {
    throw new Error('AI_MODEL_SECRETS_KEY or NEXTAUTH_SECRET is required to store model credentials.');
  }
  const secret = explicit || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('AI_MODEL_SECRETS_KEY (or NEXTAUTH_SECRET in development) is required.');
  }
  return crypto.createHash('sha256').update(`ai-model-secrets:${secret}`).digest();
}

/** Encrypt a model API key / bearer for at-rest storage. Never log the plaintext. */
export function encryptModelSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function decryptModelSecret(encoded: string): string {
  const buf = Buffer.from(encoded, 'base64url');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function secretLast4(plain: string): string {
  const trimmed = plain.trim();
  if (trimmed.length <= 4) return '****';
  return trimmed.slice(-4);
}
