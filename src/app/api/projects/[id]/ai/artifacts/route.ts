import { NextRequest } from 'next/server';
import { requireAiProject } from '@/lib/ai/control/access';
import { aiError, aiResponse } from '@/lib/ai/control/http';
import { listArtifacts } from '@/lib/ai/control/artifactQueries';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const access = await requireAiProject(request, id, false, true);
    return aiResponse(await listArtifacts(access, request.nextUrl.searchParams.get('before')));
  } catch (error) { return aiError(error); }
}
