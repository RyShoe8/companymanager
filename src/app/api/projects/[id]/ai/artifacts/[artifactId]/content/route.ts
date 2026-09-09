import { NextRequest } from 'next/server';
import { requireAiProject } from '@/lib/ai/control/access';
import { aiError, aiResponse } from '@/lib/ai/control/http';
import { getArtifactContent } from '@/lib/ai/control/artifactQueries';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string; artifactId: string }> }) {
  try {
    const { id, artifactId } = await context.params;
    const access = await requireAiProject(request, id, false, true);
    const query = request.nextUrl.searchParams;
    return aiResponse(await getArtifactContent(access, artifactId, query.get('evidence'), Number(query.get('offset') ?? '0')));
  } catch (error) { return aiError(error); }
}
