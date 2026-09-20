import { NextRequest } from 'next/server';
import { requireAiProject, AiHttpError } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { pipelineRunCreateSchema } from '@/lib/ai/rolePipeline/schemas';
import { runRolePipeline } from '@/lib/ai/rolePipeline/orchestrate';
import { AiPipelineRun, AiPipelineStageEvent } from '@/lib/models/AiRolePipeline';
import { pipelineRunMetrics } from '@/lib/ai/rolePipeline/metrics';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
let indexes: Promise<unknown> | undefined;

export async function GET(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, false, true);
    const employee = request.nextUrl.searchParams.get('employee') ?? undefined;
    const runId = request.nextUrl.searchParams.get('runId') ?? undefined;
    if (runId) {
      const run = await AiPipelineRun.findOne({
        _id: runId,
        organizationId: access.organizationId,
        projectId: access.project._id,
      })
        .maxTimeMS(3000)
        .lean();
      if (!run) throw new AiHttpError(404, 'Pipeline run not found.');
      const events = await AiPipelineStageEvent.find({ pipelineRunId: run._id })
        .sort({ sequence: 1 })
        .limit(200)
        .maxTimeMS(3000)
        .lean();
      const metrics = pipelineRunMetrics(events);
      return aiResponse({
        run: {
          id: String(run._id),
          employee: run.employee,
          brief: run.brief,
          status: run.status,
          summary: run.summary,
          totalCostMicros: run.totalCostMicros,
          createdAt: run.createdAt?.toISOString?.() ?? null,
          completedAt: run.completedAt?.toISOString?.() ?? null,
          metrics,
        },
        events: events.map((event) => ({
          id: String(event._id),
          sequence: event.sequence,
          stage: event.stage,
          status: event.status,
          modelLabel: event.modelLabel,
          modelTier: event.modelTier,
          subtaskId: event.subtaskId,
          summary: event.summary,
          failureCode: event.failureCode,
          costMicros: event.costMicros,
          reservedMicros: event.reservedMicros,
          noProviderFee: event.noProviderFee,
          createdAt: event.createdAt?.toISOString?.() ?? null,
        })),
      });
    }

    const rows = await AiPipelineRun.find({
      organizationId: access.organizationId,
      projectId: access.project._id,
      ...(employee ? { employee } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(25)
      .maxTimeMS(3000)
      .lean();
    return aiResponse({
      runs: rows.map((run) => ({
        id: String(run._id),
        employee: run.employee,
        brief: run.brief,
        status: run.status,
        summary: run.summary,
        totalCostMicros: run.totalCostMicros,
        createdAt: run.createdAt?.toISOString?.() ?? null,
        completedAt: run.completedAt?.toISOString?.() ?? null,
      })),
    });
  } catch (error) {
    return aiError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, false, true);
    const input = pipelineRunCreateSchema.parse(await readAiBody(request));
    indexes ??= Promise.all([
      AiPipelineRun.createIndexes(),
      AiPipelineStageEvent.createIndexes(),
    ]).catch((error) => {
      indexes = undefined;
      throw error;
    });
    await indexes;

    const result = await runRolePipeline({
      organizationId: access.organizationId,
      projectId: access.project._id,
      projectName: access.project.name,
      userId: access.userId,
      employee: input.employee,
      brief: input.brief,
      signal: request.signal,
    });
    return aiResponse(result, result.status === 'completed' ? 201 : 200);
  } catch (error) {
    return aiError(error);
  }
}
