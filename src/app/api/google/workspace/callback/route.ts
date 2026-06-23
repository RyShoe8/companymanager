import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { exchangeCodeForTokens } from '@/lib/google/oauth';
import {
  getDriveOAuthRedirectUri,
  upsertGoogleDriveConnection,
} from '@/lib/google/driveConnection';
import { verifyDriveOAuthState } from '@/lib/google/oauthState';
import { Types } from 'mongoose';

function appendQueryParam(url: string, key: string, value: string): string {
  const parsed = new URL(url, 'http://local');
  parsed.searchParams.set(key, value);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const stateRaw = searchParams.get('state');

    const baseUrl = new URL(request.url).origin;
    const fallbackReturn = `${baseUrl}/workspace`;

    if (error) {
      return NextResponse.redirect(
        `${fallbackReturn}?google_drive_error=${encodeURIComponent(error)}`
      );
    }
    if (!code || !stateRaw) {
      return NextResponse.redirect(`${fallbackReturn}?google_drive_error=no_code`);
    }

    const state = await verifyDriveOAuthState(stateRaw);
    if (!state || !Types.ObjectId.isValid(state.userId)) {
      return NextResponse.redirect(`${fallbackReturn}?google_drive_error=invalid_state`);
    }

    const redirectUri = getDriveOAuthRedirectUri(baseUrl);
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      const returnUrl = state.returnTo.startsWith('http')
        ? state.returnTo
        : `${baseUrl}${state.returnTo}`;
      return NextResponse.redirect(
        appendQueryParam(returnUrl, 'google_drive_error', 'no_refresh_token')
      );
    }

    await connectDB();
    await upsertGoogleDriveConnection(new Types.ObjectId(state.userId), tokens.refresh_token);

    const returnUrl = state.returnTo.startsWith('http')
      ? state.returnTo
      : `${baseUrl}${state.returnTo}`;
    return NextResponse.redirect(appendQueryParam(returnUrl, 'google_drive_connected', '1'));
  } catch (err) {
    console.error('Google workspace callback error:', err);
    const baseUrl = new URL(request.url).origin;
    return NextResponse.redirect(
      `${baseUrl}/workspace?google_drive_error=callback_failed`
    );
  }
}
