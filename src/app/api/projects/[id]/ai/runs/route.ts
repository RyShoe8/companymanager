import { NextRequest } from 'next/server';
import { requireAiProject } from '@/lib/ai/control/access';
import { listProjectRuns } from '@/lib/ai/control/runQueries';
import { aiResponse, aiError } from '@/lib/ai/control/http';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Audit history remains available when new planning is disabled; tenancy checks never change.
    const access = await requireAiProject(request, (await context.params).id, false, true);
    return aiResponse(await listProjectRuns(access, request.nextUrl.searchParams.get('cursor')));
  } catch (error) { return aiError(error); }
}
