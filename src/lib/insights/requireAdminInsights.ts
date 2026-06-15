import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/blog/requireAdmin';

export async function requireAdminInsights() {
  return requireAdminUser();
}

export function adminInsightsForbidden(error: NextResponse) {
  return error;
}

export type AdminInsightsContext = Awaited<ReturnType<typeof requireAdminInsights>>;
