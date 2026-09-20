import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { requireAiProject, AiHttpError } from '@/lib/ai/control/access';
import { aiError } from '@/lib/ai/control/http';
import { AiIdeExecutionArtifact } from '@/lib/models/AiIdeExecutionArtifact';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string; artifactId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const params = await context.params;
    if (!Types.ObjectId.isValid(params.artifactId)) throw new AiHttpError(400, 'Invalid execution artifact id.');
    const access = await requireAiProject(request, params.id, false, true);
    const artifact = await AiIdeExecutionArtifact.findOne({
      _id: params.artifactId, organizationId: access.organizationId, projectId: access.project._id,
    }).select('+patch').maxTimeMS(3000).lean();
    if (!artifact?.patch) throw new AiHttpError(404, 'Execution artifact is unavailable or expired.');
    const stored = artifact.patch as unknown as Buffer | { buffer: Buffer };
    const patchText = (Buffer.isBuffer(stored) ? stored : Buffer.from(stored.buffer)).toString('utf8');
    return new NextResponse(patchText, {
      status: 200,
      headers: {
        'Content-Type': 'text/x-diff; charset=utf-8',
        'Content-Disposition': `attachment; filename="nucleas-execution-${params.artifactId}.patch"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) { return aiError(error); }
}
