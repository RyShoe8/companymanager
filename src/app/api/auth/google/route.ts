import { NextRequest, NextResponse } from 'next/server';

/**
 * Initiate Google OAuth flow
 * Redirects user to Google OAuth consent screen
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  
  // Construct redirect URI from request URL to ensure it uses the correct domain
  const baseUrl = new URL(request.url).origin;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/google/callback`;
  
  if (!clientId) {
    // Redirect to login page with error message instead of returning JSON
    const url = new URL('/login', request.url);
    url.searchParams.set('error', 'oauth_not_configured');
    return NextResponse.redirect(url);
  }

  const searchParams = request.nextUrl.searchParams;
  const invitationToken = searchParams.get('invitationToken');
  const state = invitationToken ? Buffer.from(JSON.stringify({ invitationToken })).toString('base64') : undefined;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    ...(state && { state }),
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  
  return NextResponse.redirect(authUrl);
}
