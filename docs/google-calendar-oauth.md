# Google Calendar OAuth setup

Calendar connect uses a **separate redirect URI** from Google sign-in. If you see `Error 400: redirect_uri_mismatch`, the scheduling callback is missing from your OAuth client.

## Redirect URIs to register

In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → your **OAuth 2.0 Client ID** (Web application) → **Authorized redirect URIs**, add:

| Environment | URI |
|-------------|-----|
| Production | `https://nucleas.app/api/scheduling/google/callback` |
| Production (sign-in, if missing) | `https://nucleas.app/api/auth/google/callback` |
| Local dev | `http://localhost:3000/api/scheduling/google/callback` |

Save and wait a few minutes for Google to propagate changes.

## Enable API and scopes

1. **APIs & Services** → **Library** → enable **Google Calendar API**.
2. **OAuth consent screen** → **Scopes** → add:
   - `https://www.googleapis.com/auth/calendar`

Sign-in scopes (`openid`, `email`, `profile`) stay unchanged.

## Vercel environment variables

Set in the Vercel project (Production):

| Variable | Example / notes |
|----------|-----------------|
| `GOOGLE_CLIENT_ID` | Same client ID as Google sign-in |
| `GOOGLE_CLIENT_SECRET` | Same client secret as sign-in |
| `NEXTAUTH_URL` | `https://nucleas.app` |
| `GOOGLE_CALENDAR_REDIRECT_URI` | `https://nucleas.app/api/scheduling/google/callback` (recommended; must match GCP exactly) |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | Random 32+ character secret (encrypts stored refresh tokens) |

Redeploy after changing env vars.

`GOOGLE_REDIRECT_URI` is only for login (`/api/auth/google/callback`), not calendar.

## Verify

1. Workspace → **Schedule** → **Connect Google Calendar**
2. Success: redirect to `/workspace?phase=Schedule&calendar_connected=1`
3. If it still fails, open Google’s **error details** and copy the `redirect_uri` value — that exact string must appear in Authorized redirect URIs.

## How the app picks the redirect URI

[`getCalendarOAuthRedirectUri`](../src/lib/scheduling/googleCalendar.ts) uses, in order:

1. `GOOGLE_CALENDAR_REDIRECT_URI`
2. `NEXTAUTH_URL` + `/api/scheduling/google/callback`
3. Request host origin + `/api/scheduling/google/callback` (local dev fallback)

Connect and callback always use the same helper so the URI cannot drift between steps.
