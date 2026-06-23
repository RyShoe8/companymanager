import { SignJWT, jwtVerify } from 'jose';

const secret = process.env.NEXTAUTH_SECRET;
if (!secret) {
  throw new Error('NEXTAUTH_SECRET environment variable is required');
}

const key = new TextEncoder().encode(secret);

type DriveOAuthStatePayload = {
  userId: string;
  purpose: 'drive-connect';
  returnTo: string;
};

export async function createDriveOAuthState(userId: string, returnTo: string): Promise<string> {
  return new SignJWT({
    userId,
    purpose: 'drive-connect',
    returnTo,
  } satisfies DriveOAuthStatePayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(key);
}

export async function verifyDriveOAuthState(
  token: string
): Promise<DriveOAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    const userId = typeof payload.userId === 'string' ? payload.userId : '';
    const purpose = payload.purpose === 'drive-connect' ? payload.purpose : null;
    const returnTo = typeof payload.returnTo === 'string' ? payload.returnTo : '/workspace';
    if (!userId || !purpose) return null;
    return { userId, purpose, returnTo };
  } catch {
    return null;
  }
}
