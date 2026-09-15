import { NextRequest } from 'next/server';
import { requireAiProject } from '@/lib/ai/control/access';
import { aiError, aiResponse } from '@/lib/ai/control/http';
import { loadIdeProjectSpend } from '@/lib/ide/ideSpend';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const projectId = (await context.params).id;
    const access = await requireAiProject(request, projectId, false, true);
    const spend = await loadIdeProjectSpend(access.organizationId, projectId);
    return aiResponse(spend);
  } catch (error) {
    return aiError(error);
  }
}
