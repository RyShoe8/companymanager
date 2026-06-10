import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const ENC_PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const explicitSecret = process.env.ACTION_BUTTON_ENCRYPTION_KEY;
  // NEXTAUTH_SECRET is always set (auth depends on it); used as fallback so
  // existing deployments keep working until the dedicated key is provisioned.
  const secret = explicitSecret || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('ACTION_BUTTON_ENCRYPTION_KEY or NEXTAUTH_SECRET is required');
  }
  return crypto.createHash('sha256').update(`action-button:${secret}`).digest();
}

export function isEncryptedActionButtonPassword(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

export function encryptActionButtonPassword(plain: string): string {
  if (!plain) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${Buffer.concat([iv, tag, enc]).toString('base64url')}`;
}

/** Decrypts an encrypted password; legacy plaintext values are returned as-is. */
export function decryptActionButtonPassword(stored: string): string {
  if (!stored || !isEncryptedActionButtonPassword(stored)) return stored;
  try {
    const buf = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64url');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

type ActionButtonLike = {
  label: string;
  url: string;
  kind?: string;
  password?: string;
  referralSourceId?: unknown;
};

/**
 * Serializes action buttons for API responses. Passwords are only included
 * (decrypted) when the caller is allowed to view them (Manager/Administrator).
 */
export function serializeActionButtons(
  buttons: ActionButtonLike[] | undefined,
  includePasswords: boolean
): ActionButtonLike[] {
  return (buttons || []).map((b) => {
    const base: ActionButtonLike = {
      label: b.label,
      url: b.url,
      ...(b.kind ? { kind: b.kind } : {}),
      ...(b.referralSourceId ? { referralSourceId: b.referralSourceId } : {}),
    };
    if (includePasswords && b.password) {
      base.password = decryptActionButtonPassword(b.password);
    }
    return base;
  });
}

/** Removes action-button passwords from a project object before returning it via generic project APIs. */
export function stripActionButtonPasswords<
  T extends { actionButtons?: ActionButtonLike[] },
>(project: T): T {
  if (!project?.actionButtons?.length) return project;
  return {
    ...project,
    actionButtons: project.actionButtons.map((b) => {
      if (b.password === undefined) return b;
      const { password: _password, ...rest } = b;
      return rest;
    }),
  };
}
