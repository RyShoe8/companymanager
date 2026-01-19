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
  
- `BREVO_API_KEY`: Your Brevo API key for sending emails
  - Get your API key from: https://app.brevo.com/settings/keys/api
  
- `BREVO_SENDER_EMAIL`: Email address to send from
  - **Must be set to:** `theteam@nucleas.app`
  - This email must be verified in your Brevo account
  
- `BREVO_SENDER_NAME`: Name to display as sender (optional)
  - Defaults to "Nucleas" if not set

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
