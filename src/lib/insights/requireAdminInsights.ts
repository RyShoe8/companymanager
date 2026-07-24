import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/blog/requireAdmin';

export async function requireAdminInsights() {
  return requireAdminUser();
}

function adminInsightsForbidden(error: NextResponse) {
  return error;
}

type AdminInsightsContext = Awaited<ReturnType<typeof requireAdminInsights>>;
