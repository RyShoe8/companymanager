import { SignJWT, jwtVerify } from 'jose';

const secret = process.env.NEXTAUTH_SECRET;
if (!secret) {
  throw new Error('NEXTAUTH_SECRET environment variable is required');
}

const key = new TextEncoder().encode(secret);

type CalendarOAuthStatePayload = {
  userId: string;
  purpose: 'calendar-connect';
};

export async function createCalendarOAuthState(userId: string): Promise<string> {
  return new SignJWT({ userId, purpose: 'calendar-connect' } satisfies CalendarOAuthStatePayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(key);
}

export async function verifyCalendarOAuthState(
  token: string
): Promise<CalendarOAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    const userId = typeof payload.userId === 'string' ? payload.userId : '';
    const purpose = payload.purpose === 'calendar-connect' ? payload.purpose : null;
    if (!userId || !purpose) return null;
    return { userId, purpose };
  } catch {
    return null;
  }
}
