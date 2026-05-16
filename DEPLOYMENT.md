# Deployment Guide

## Vercel Deployment

This application is ready to deploy to Vercel. Follow these steps:

### 1. Push to Git

Push your code to a Git repository (GitHub, GitLab, or Bitbucket).

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your Git repository
4. Vercel will automatically detect Next.js

### 3. Configure Environment Variables

In the Vercel project settings, add the following environment variables:

- `MONGODB_URI`: Your MongoDB Atlas connection string
  - Format: `mongodb+srv://username:password@cluster.mongodb.net/company-manager?retryWrites=true&w=majority`
  
- `NEXTAUTH_SECRET`: A random secret key for session encryption
  - Generate one using: `openssl rand -base64 32`
  
- `NEXTAUTH_URL`: Your Vercel deployment URL
  - Format: `https://your-app.vercel.app`
  - Vercel will provide this after first deployment
  
- `BREVO_API_KEY`: Your Brevo **REST API v3** key for sending emails (required for team member invites)
  - Get your API key from: https://app.brevo.com/settings/keys/api
  - Use a REST API key, **not** an SMTP key (`xsmtpsib-…`). SMTP keys do not work with the Brevo SDK used by this app.
  - If missing or wrong, employees save successfully but invite emails are not delivered (`emailSent: false` in the API response; use **Resend invite** on the Team page after fixing the key).
  
- `BREVO_SENDER_EMAIL`: Email address to send from
  - **Must be set to:** `theteam@nucleas.app`
  - This email must be verified in your Brevo account
  
- `BREVO_SENDER_NAME`: Name to display as sender (optional)
  - Defaults to "Nucleas" if not set

- `BLOB_READ_WRITE_TOKEN`: Vercel Blob store token for project logo uploads (required on Vercel)
  - On Vercel the filesystem is read-only; project logos are stored in Vercel Blob when this is set.
  - Create a Blob store in your Vercel project (Storage tab) and add the token as an environment variable.
  - Leave unset for local development (logos are saved to `public/uploads/projects/`).

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Same OAuth client as Google sign-in (optional but required for Google login and calendar)

- `GOOGLE_REDIRECT_URI`: Login callback only (optional)
  - Production: `https://nucleas.app/api/auth/google/callback`

- `GOOGLE_CALENDAR_REDIRECT_URI`: **Calendar connect callback** (required for Workspace → Schedule → Connect Google Calendar)
  - Production: `https://nucleas.app/api/scheduling/google/callback`
  - Must be listed in Google Cloud **Authorized redirect URIs** (separate from login callback)

- `CALENDAR_TOKEN_ENCRYPTION_KEY`: Random secret to encrypt stored Google Calendar refresh tokens (recommended in production)

See [docs/google-calendar-oauth.md](docs/google-calendar-oauth.md) for Google Cloud Console steps (enable Calendar API, consent screen scope, redirect URIs).

#### Employee invite emails

Team member invites are sent when you add or update an employee with an email (before they register). Requirements:

- `BREVO_API_KEY` must be a valid REST API v3 key (see above).
- `NEXTAUTH_URL` should match your production URL (e.g. `https://nucleas.app`) so invite links in emails point to the correct host.
- Sender `theteam@nucleas.app` must be verified in Brevo.

If an invite fails to send, the employee record is still created; the Team page shows a warning and a **Resend invite** action for pending members.

### 4. MongoDB Atlas Configuration

1. Ensure your MongoDB Atlas cluster allows connections from anywhere (0.0.0.0/0) or add Vercel IPs
2. Make sure your database user has read/write permissions
3. Test the connection string locally before deploying

### 5. Deploy

Click "Deploy" and Vercel will build and deploy your application automatically.

### 6. Post-Deployment

After deployment, update `NEXTAUTH_URL` with your actual production URL if needed.

## Local Development

1. Copy `.env.local.example` to `.env.local`
2. Fill in your MongoDB connection string and secrets
3. Run `npm install` to install dependencies
4. Run `npm run dev` to start the development server
