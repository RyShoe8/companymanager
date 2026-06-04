import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import {
  exchangeCodeForTokens,
  getCalendarOAuthRedirectUri,
} from '@/lib/scheduling/googleCalendar';
import { upsertGoogleConnection } from '@/lib/scheduling/calendarConnection';
import { Types } from 'mongoose';
import { verifyCalendarOAuthState } from '@/lib/scheduling/oauthState';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const stateRaw = searchParams.get('state');

    const baseUrl = new URL(request.url).origin;
    const workspaceUrl = `${baseUrl}/workspace?phase=Schedule`;

    if (error) {
      return NextResponse.redirect(
        `${workspaceUrl}&calendar_error=${encodeURIComponent(error)}`
      );
    }
    if (!code || !stateRaw) {
      return NextResponse.redirect(`${workspaceUrl}&calendar_error=no_code`);
    }

    const state = await verifyCalendarOAuthState(stateRaw);
    if (!state || !Types.ObjectId.isValid(state.userId)) {
      return NextResponse.redirect(`${workspaceUrl}&calendar_error=invalid_state`);
    }
    const userId = state.userId;

    const redirectUri = getCalendarOAuthRedirectUri(baseUrl);

    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${workspaceUrl}&calendar_error=no_refresh_token`);
    }

    await connectDB();
    await upsertGoogleConnection(new Types.ObjectId(userId), tokens.refresh_token);

    return NextResponse.redirect(`${workspaceUrl}&calendar_connected=1`);
  } catch (err) {
    console.error('Calendar callback error:', err);
    const baseUrl = new URL(request.url).origin;
    return NextResponse.redirect(
      `${baseUrl}/workspace?phase=Schedule&calendar_error=callback_failed`
    );
  }
}
