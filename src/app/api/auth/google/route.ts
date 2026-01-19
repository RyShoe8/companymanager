import { NextRequest, NextResponse } from 'next/server';

/**
 * Initiate Google OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
    }

    // Construct redirect URI from request URL to ensure it uses the correct domain
    const baseUrl = new URL(request.url).origin;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/google/callback`;

    // Get invitation token from query params if present
    const searchParams = request.nextUrl.searchParams;
    const invitationToken = searchParams.get('invitation');

    // Build state parameter (base64 encoded JSON) if invitation token exists
    let state = '';
    if (invitationToken) {
      const stateData = { invitationToken };
      state = Buffer.from(JSON.stringify(stateData)).toString('base64');
    }

    // Google OAuth authorization URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    
    if (state) {
      authUrl.searchParams.set('state', state);
    }

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    // Google OAuth initiation error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
