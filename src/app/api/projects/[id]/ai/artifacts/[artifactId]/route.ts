import { NextRequest } from 'next/server';
import { requireAiProject } from '@/lib/ai/control/access';
import { aiError, aiResponse } from '@/lib/ai/control/http';
import { getArtifactDetail } from '@/lib/ai/control/artifactQueries';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string; artifactId: string }> }) {
  try {
    const { id, artifactId } = await context.params;
    const access = await requireAiProject(request, id, false, true);
    return aiResponse(await getArtifactDetail(access, artifactId));
  } catch (error) { return aiError(error); }
}
