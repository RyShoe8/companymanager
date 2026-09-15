import type { IdePlanDocument } from '@/lib/ide/idePlan';

/** Rebuild plan markdown from editable fields for Approve → build. */
export function rebuildIdePlanMarkdown(plan: Pick<IdePlanDocument, 'title' | 'summary' | 'steps'>): string {
  const parts = [
    `# ${plan.title.trim() || 'Plan'}`,
    plan.summary.trim() ? plan.summary.trim() : '',
    plan.steps.length
      ? plan.steps
          .map((step) => step.trim())
          .filter(Boolean)
          .map((step, index) => `${index + 1}. ${step}`)
          .join('\n')
      : '',
  ].filter(Boolean);
  return parts.join('\n\n').slice(0, 8000);
}

export function withRebuiltPlanMarkdown(plan: IdePlanDocument): IdePlanDocument {
  return {
    ...plan,
    title: plan.title.slice(0, 200),
    summary: plan.summary.slice(0, 2000),
    steps: plan.steps.map((step) => step.slice(0, 500)),
    markdown: rebuildIdePlanMarkdown(plan),
  };
}
