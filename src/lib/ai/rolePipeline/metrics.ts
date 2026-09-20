export type PipelineMetricEvent = {
  stage: 'planner' | 'worker' | 'reviewer';
  status: 'running' | 'completed' | 'blocked' | 'cancelled';
  modelTier?: 'commercial' | 'local_remote' | null;
  costMicros?: number | null;
  reservedMicros?: number | null;
  noProviderFee?: boolean;
};

export function pipelineRunMetrics(events: PipelineMetricEvent[]) {
  const completed = events.filter((event) => event.status === 'completed' || event.status === 'blocked');
  const starts = events.filter((event) => event.status === 'running');
  const stageInvocations = { planner: 0, worker: 0, reviewer: 0 };
  const costByStageMicros = { planner: 0, worker: 0, reviewer: 0 };
  let commercialCostMicros = 0;
  let totalCostMicros = 0;

  for (const event of starts) stageInvocations[event.stage] += 1;
  for (const event of completed) {
    const cost = event.noProviderFee ? 0 : (event.costMicros ?? event.reservedMicros ?? 0);
    costByStageMicros[event.stage] += cost;
    totalCostMicros += cost;
    if (event.modelTier === 'commercial') commercialCostMicros += cost;
  }

  return {
    stageInvocations,
    correctionPasses: Math.max(0, stageInvocations.worker - 1),
    costByStageMicros,
    commercialCostMicros,
    commercialCostSharePercent: totalCostMicros > 0 ? Math.round((commercialCostMicros / totalCostMicros) * 10_000) / 100 : 0,
  };
}
