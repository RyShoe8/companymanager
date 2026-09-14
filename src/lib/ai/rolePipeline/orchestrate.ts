import 'server-only';
import { Types } from 'mongoose';
import { GatewayError } from '@nucleas/ai-core/gateway';
import { AiHttpError } from '@/lib/ai/control/access';
import {
  plannerOutputSchema,
  reviewerOutputSchema,
} from '@/lib/ai/rolePipeline/schemas';
import { invokeProfileStage } from '@/lib/ai/rolePipeline/stageInvoke';
import {
  AiPipelineRun,
  AiPipelineStageEvent,
  AiRolePipeline,
} from '@/lib/models/AiRolePipeline';
import { aiEmployees, type AiEmployeeKey } from '@/lib/ai/teamWorkspace';

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new GatewayError('invalid_response');
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new GatewayError('invalid_response');
  }
}

async function appendEvent(input: {
  organizationId: string;
  projectId: Types.ObjectId;
  pipelineRunId: Types.ObjectId;
  sequence: number;
  stage: 'planner' | 'worker' | 'reviewer';
  status: 'running' | 'completed' | 'blocked' | 'cancelled';
  modelProfileId?: string;
  modelLabel?: string;
  subtaskId?: string | null;
  summary: string;
  failureCode?: string | null;
  costMicros?: number | null;
  reservedMicros?: number | null;
  noProviderFee?: boolean;
  aiRunId?: string | null;
}) {
  await AiPipelineStageEvent.create({
    organizationId: input.organizationId,
    projectId: input.projectId,
    pipelineRunId: input.pipelineRunId,
    sequence: input.sequence,
    stage: input.stage,
    status: input.status,
    modelProfileId: input.modelProfileId,
    modelLabel: input.modelLabel,
    subtaskId: input.subtaskId ?? null,
    summary: input.summary.slice(0, 4000),
    failureCode: input.failureCode ?? null,
    costMicros: input.costMicros ?? null,
    reservedMicros: input.reservedMicros ?? null,
    noProviderFee: input.noProviderFee ?? false,
    aiRunId: input.aiRunId ?? null,
  });
}

export async function runRolePipeline(input: {
  organizationId: string;
  projectId: Types.ObjectId;
  projectName: string;
  userId: string;
  employee: AiEmployeeKey;
  brief: string;
  signal?: AbortSignal;
}): Promise<{ runId: string; status: string; summary: string }> {
  const pipeline = await AiRolePipeline.findOne({
    organizationId: input.organizationId,
    employee: input.employee,
  })
    .maxTimeMS(3000)
    .lean();
  if (!pipeline || !pipeline.enabled) {
    throw new AiHttpError(400, 'Configure and enable a role pipeline for this employee before running.');
  }

  const role = aiEmployees.find((item) => item.id === input.employee)!;
  const [run] = await AiPipelineRun.create([
    {
      organizationId: input.organizationId,
      projectId: input.projectId,
      employee: input.employee,
      brief: input.brief.slice(0, 6000),
      status: 'running',
      createdByUserId: new Types.ObjectId(input.userId),
      summary: '',
    },
  ]);

  let sequence = 0;
  let totalReserved = 0;
  const bumpCost = (reserved: number, settled: number | null, noFee: boolean) => {
    if (noFee) return;
    totalReserved += settled ?? reserved;
  };

  try {
    sequence += 1;
    await appendEvent({
      organizationId: input.organizationId,
      projectId: input.projectId,
      pipelineRunId: run._id,
      sequence,
      stage: 'planner',
      status: 'running',
      modelProfileId: String(pipeline.planner.modelProfileId),
      summary: 'Planner stage started.',
    });

    const planner = await invokeProfileStage({
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
      modelProfileId: String(pipeline.planner.modelProfileId),
      model: String((pipeline.planner as { model?: string }).model ?? ''),
      signal: input.signal,
      messages: [
        {
          role: 'system',
          content: [
            `You are the Planner for Nucleas role "${role.name}" on project "${input.projectName}".`,
            role.description,
            'Return ONLY a JSON object with shape:',
            '{"summary": string, "subtasks": [{"id": string, "title": string, "instructions": string, "acceptanceChecks": string[]}]}',
            `Emit between 1 and ${pipeline.maxSubtasks} subtasks. Do not invent tools, browsing, or completed work.`,
          ].join(' '),
        },
        { role: 'user', content: input.brief.slice(0, 6000) },
      ],
    });
    bumpCost(planner.reservedMicros, planner.costMicros, planner.noProviderFee);

    const plan = plannerOutputSchema.parse(extractJsonObject(planner.content));
    const subtasks = plan.subtasks.slice(0, pipeline.maxSubtasks);
    sequence += 1;
    await appendEvent({
      organizationId: input.organizationId,
      projectId: input.projectId,
      pipelineRunId: run._id,
      sequence,
      stage: 'planner',
      status: 'completed',
      modelProfileId: planner.profile.id,
      modelLabel: `${planner.profile.label} · ${planner.profile.model}`,
      summary: plan.summary.slice(0, 4000),
      costMicros: planner.costMicros,
      reservedMicros: planner.reservedMicros,
      noProviderFee: planner.noProviderFee,
      aiRunId: planner.aiRunId,
    });

    for (const subtask of subtasks) {
      let attempt = 0;
      let notes = '';
      let passed = false;
      while (attempt <= pipeline.maxWorkerRetries) {
        attempt += 1;
        sequence += 1;
        await appendEvent({
          organizationId: input.organizationId,
          projectId: input.projectId,
          pipelineRunId: run._id,
          sequence,
          stage: 'worker',
          status: 'running',
          modelProfileId: String(pipeline.worker.modelProfileId),
          subtaskId: subtask.id,
          summary: `Worker attempt ${attempt} for ${subtask.title}.`,
        });

        const worker = await invokeProfileStage({
          organizationId: input.organizationId,
          projectId: input.projectId,
          userId: input.userId,
          modelProfileId: String(pipeline.worker.modelProfileId),
          model: String((pipeline.worker as { model?: string }).model ?? ''),
          signal: input.signal,
          messages: [
            {
              role: 'system',
              content: [
                `You are the Worker for Nucleas role "${role.name}" on project "${input.projectName}".`,
                'Execute only the given subtask. Do not claim to have changed live systems or browsed the web.',
                notes ? `Reviewer notes from prior attempt: ${notes}` : '',
              ]
                .filter(Boolean)
                .join(' '),
            },
            {
              role: 'user',
              content: [
                `Subtask: ${subtask.title}`,
                subtask.instructions,
                `Acceptance checks:\n- ${subtask.acceptanceChecks.join('\n- ')}`,
              ].join('\n\n'),
            },
          ],
        });
        bumpCost(worker.reservedMicros, worker.costMicros, worker.noProviderFee);
        sequence += 1;
        await appendEvent({
          organizationId: input.organizationId,
          projectId: input.projectId,
          pipelineRunId: run._id,
          sequence,
          stage: 'worker',
          status: 'completed',
          modelProfileId: worker.profile.id,
          modelLabel: `${worker.profile.label} · ${worker.profile.model}`,
          subtaskId: subtask.id,
          summary: worker.content.slice(0, 4000),
          costMicros: worker.costMicros,
          reservedMicros: worker.reservedMicros,
          noProviderFee: worker.noProviderFee,
          aiRunId: worker.aiRunId,
        });

        sequence += 1;
        await appendEvent({
          organizationId: input.organizationId,
          projectId: input.projectId,
          pipelineRunId: run._id,
          sequence,
          stage: 'reviewer',
          status: 'running',
          modelProfileId: String(pipeline.reviewer.modelProfileId),
          subtaskId: subtask.id,
          summary: `Reviewer checking ${subtask.title}.`,
        });

        const reviewer = await invokeProfileStage({
          organizationId: input.organizationId,
          projectId: input.projectId,
          userId: input.userId,
          modelProfileId: String(pipeline.reviewer.modelProfileId),
          model: String((pipeline.reviewer as { model?: string }).model ?? ''),
          signal: input.signal,
          messages: [
            {
              role: 'system',
              content: [
                `You are the Reviewer for Nucleas role "${role.name}".`,
                'Return ONLY JSON: {"decision":"pass"|"retry"|"fail","notes":string}.',
                'Use retry only when the worker output is fixable. Use fail when acceptance cannot be met.',
              ].join(' '),
            },
            {
              role: 'user',
              content: [
                `Subtask: ${subtask.title}`,
                `Instructions: ${subtask.instructions}`,
                `Acceptance checks:\n- ${subtask.acceptanceChecks.join('\n- ')}`,
                `Worker output:\n${worker.content.slice(0, 5000)}`,
              ].join('\n\n'),
            },
          ],
        });
        bumpCost(reviewer.reservedMicros, reviewer.costMicros, reviewer.noProviderFee);
        const review = reviewerOutputSchema.parse(extractJsonObject(reviewer.content));
        sequence += 1;
        await appendEvent({
          organizationId: input.organizationId,
          projectId: input.projectId,
          pipelineRunId: run._id,
          sequence,
          stage: 'reviewer',
          status: review.decision === 'fail' ? 'blocked' : 'completed',
          modelProfileId: reviewer.profile.id,
          modelLabel: `${reviewer.profile.label} · ${reviewer.profile.model}`,
          subtaskId: subtask.id,
          summary: `${review.decision}: ${review.notes}`.slice(0, 4000),
          failureCode: review.decision === 'fail' ? 'review_failed' : null,
          costMicros: reviewer.costMicros,
          reservedMicros: reviewer.reservedMicros,
          noProviderFee: reviewer.noProviderFee,
          aiRunId: reviewer.aiRunId,
        });

        if (review.decision === 'pass') {
          passed = true;
          break;
        }
        if (review.decision === 'fail' || attempt > pipeline.maxWorkerRetries) {
          await AiPipelineRun.updateOne(
            { _id: run._id },
            {
              $set: {
                status: 'blocked',
                summary: `Blocked on subtask ${subtask.id}: ${review.notes}`.slice(0, 4000),
                totalCostMicros: totalReserved || null,
                completedAt: new Date(),
              },
            }
          );
          return {
            runId: String(run._id),
            status: 'blocked',
            summary: `Blocked on subtask ${subtask.id}: ${review.notes}`,
          };
        }
        notes = review.notes;
      }
      if (!passed) {
        await AiPipelineRun.updateOne(
          { _id: run._id },
          {
            $set: {
              status: 'blocked',
              summary: `Retries exhausted for subtask ${subtask.id}`.slice(0, 4000),
              totalCostMicros: totalReserved || null,
              completedAt: new Date(),
            },
          }
        );
        return {
          runId: String(run._id),
          status: 'blocked',
          summary: `Retries exhausted for subtask ${subtask.id}`,
        };
      }
    }

    const summary = `Completed ${subtasks.length} subtask(s). ${plan.summary}`.slice(0, 4000);
    await AiPipelineRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: 'completed',
          summary,
          totalCostMicros: totalReserved || null,
          completedAt: new Date(),
        },
      }
    );
    return { runId: String(run._id), status: 'completed', summary };
  } catch (error) {
    const failureCode = error instanceof GatewayError ? error.code : 'unavailable';
    const message =
      error instanceof AiHttpError
        ? error.message
        : error instanceof GatewayError
          ? `Pipeline stage failed (${failureCode}).`
          : 'Pipeline failed before completion.';
    sequence += 1;
    await appendEvent({
      organizationId: input.organizationId,
      projectId: input.projectId,
      pipelineRunId: run._id,
      sequence,
      stage: 'planner',
      status: 'blocked',
      summary: message,
      failureCode,
    }).catch(() => undefined);
    await AiPipelineRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: 'blocked',
          summary: message.slice(0, 4000),
          totalCostMicros: totalReserved || null,
          completedAt: new Date(),
        },
      }
    ).catch(() => undefined);
    if (error instanceof AiHttpError) throw error;
    throw new AiHttpError(503, message);
  }
}
