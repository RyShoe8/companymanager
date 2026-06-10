import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const explicitSecret = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (process.env.NODE_ENV === 'production' && !explicitSecret) {
    throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY is required in production');
  }
  // Dev fallback: derive from existing secrets only — never a hardcoded literal.
  const secret = explicitSecret || process.env.GOOGLE_CLIENT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      'CALENDAR_TOKEN_ENCRYPTION_KEY (or GOOGLE_CLIENT_SECRET / NEXTAUTH_SECRET in development) is required'
    );
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function decryptToken(encoded: string): string {
  const buf = Buffer.from(encoded, 'base64url');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function generateAgendaToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}
