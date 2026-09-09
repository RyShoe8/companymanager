import { NextRequest } from 'next/server';
import { requireBudgetAccess } from '@/lib/ai/control/budgetSettings';
import { budgetHistory } from '@/lib/ai/control/budgetHistory';
import { aiError, aiResponse } from '@/lib/ai/control/http';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const access = await requireBudgetAccess(request);
    return aiResponse(await budgetHistory(access.organizationId, access.projectId, request.nextUrl.searchParams.get('before')));
  } catch (error) { return aiError(error); }
}
