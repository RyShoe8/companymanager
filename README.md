# Company Manager

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
BREVO_SENDER_EMAIL=your_sender_email@example.com (optional - only if you want to override Brevo's default sender)
BREVO_SENDER_NAME=Company Manager (optional - only if you want to override Brevo's default sender name)
```

**Environment Variables:**
- `MONGODB_URI` - Your MongoDB Atlas connection string (required)
- `NEXTAUTH_SECRET` - A random secret key for session encryption (required)
- `NEXTAUTH_URL` - Your application URL (required)
- `BREVO_API_KEY` - Your Brevo API key for sending emails (required for invitations)
- `BREVO_SENDER_EMAIL` - Email address to send from (optional - if not set, Brevo will use your account's default sender)
- `BREVO_SENDER_NAME` - Name to display as sender (optional - if not set, Brevo will use your account's default sender name)

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Tech Stack

- **Next.js 16** - React framework with App Router
- **MongoDB Atlas** - Database
- **Mongoose** - ODM for MongoDB
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
