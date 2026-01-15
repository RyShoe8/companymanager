# Nucleas

A Next.js application for company planning and asset management.

## Features

- **Planning Map**: Visual calendar view for projects across multiple time horizons (Today, Weekly, Monthly, Quarterly, Yearly)
- **Asset Repository**: Centralized directory of tools, documents, and resources
- **Employee Management**: Track employee capacity, workload, and assignments
- **Project Management**: Create projects with stages, estimated hours, and assignments
- **Role-Based Access Control**: Administrator and User roles with appropriate permissions

## Getting Started

First, install dependencies:

```bash
npm install
```

Create a `.env.local` file in the root directory with your environment variables:

```
MONGODB_URI=your_mongodb_connection_string
NEXTAUTH_SECRET=your_secret_key
NEXTAUTH_URL=http://localhost:3000
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=theteam@nucleas.app (optional - defaults to theteam@nucleas.app if not set)
BREVO_SENDER_NAME=Nucleas (optional - defaults to "Nucleas" if not set)
GOOGLE_CLIENT_ID=your_google_client_id (optional - for Google OAuth)
GOOGLE_CLIENT_SECRET=your_google_client_secret (optional - for Google OAuth)
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback (optional - defaults to NEXTAUTH_URL + /api/auth/google/callback)
```

**Environment Variables:**
- `MONGODB_URI` - Your MongoDB Atlas connection string (required)
- `NEXTAUTH_SECRET` - A random secret key for session encryption (required)
- `NEXTAUTH_URL` - Your application URL (required)
- `BREVO_API_KEY` - Your Brevo API key for sending emails (required for invitations)
- `BREVO_SENDER_EMAIL` - Email address to send from (optional - defaults to theteam@nucleas.app)
- `BREVO_SENDER_NAME` - Name to display as sender (optional - defaults to "Nucleas")
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID (optional - enables Google sign-in)
- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret (optional - required if GOOGLE_CLIENT_ID is set)
- `GOOGLE_REDIRECT_URI` - Google OAuth redirect URI (optional - defaults to NEXTAUTH_URL + /api/auth/google/callback)

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Google OAuth Setup (Optional)

To enable Google sign-in:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Configure the OAuth consent screen:
   - User Type: External (unless you have a Google Workspace)
   - App name: Nucleas
   - Support email: your email
   - Scopes: email, profile, openid
6. Create OAuth client ID:
   - Application type: Web application
   - Authorized redirect URIs: 
     - `http://localhost:3000/api/auth/google/callback` (for development)
     - `https://your-domain.com/api/auth/google/callback` (for production)
7. Copy the Client ID and Client Secret to your `.env.local` file

**Note:** Google OAuth is optional. If not configured, users can still sign up and log in with email/password.

## Tech Stack

- **Next.js 16** - React framework with App Router
- **MongoDB Atlas** - Database
- **Mongoose** - ODM for MongoDB
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
