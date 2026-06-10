import { SignJWT, jwtVerify } from 'jose';

const secret = process.env.NEXTAUTH_SECRET;
if (!secret) {
  throw new Error('NEXTAUTH_SECRET environment variable is required');
}

const key = new TextEncoder().encode(secret);

type LoginOAuthStatePayload = {
  purpose: 'google-login';
  invitationToken?: string;
};

/** CSRF protection for the Google login OAuth flow: short-lived signed state. */
export async function createLoginOAuthState(invitationToken?: string): Promise<string> {
  return new SignJWT({
    purpose: 'google-login',
    ...(invitationToken ? { invitationToken } : {}),
  } satisfies LoginOAuthStatePayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(key);
}

export async function verifyLoginOAuthState(
  token: string
): Promise<LoginOAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    if (payload.purpose !== 'google-login') return null;
    const invitationToken =
      typeof payload.invitationToken === 'string' ? payload.invitationToken : undefined;
    return { purpose: 'google-login', ...(invitationToken ? { invitationToken } : {}) };
  } catch {
    return null;
  }
}
