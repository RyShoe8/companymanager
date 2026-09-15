'use client';

import type { IdePlanDocument } from '@/lib/ide/idePlan';
import { withRebuiltPlanMarkdown } from '@/lib/ide/rebuildPlanMarkdown';

type Props = {
  plan: IdePlanDocument;
  onApprove: () => void;
  onReject: () => void;
  onChange: (plan: IdePlanDocument) => void;
  approveDisabled?: boolean;
};

const field =
  'w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-text-primary';

export default function IdePlanPane({
  plan,
  onApprove,
  onReject,
  onChange,
  approveDisabled,
}: Props) {
  const editable = plan.status === 'ready_for_review';
  const showApprove = editable;

  function patch(partial: Partial<IdePlanDocument>) {
    onChange(withRebuiltPlanMarkdown({ ...plan, ...partial }));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex items-start justify-between gap-3 border-b border-border px-3 py-2 text-sm">
        <div className="min-w-0 flex-1">
          {editable ? (
            <textarea
              className={`${field} min-h-[2.5rem] resize-y font-medium break-words`}
              value={plan.title}
              aria-label="Plan title"
              rows={2}
              onChange={(event) => patch({ title: event.target.value })}
            />
          ) : (
            <p className="break-words font-medium text-text-primary">{plan.title}</p>
          )}
          <p className="mt-0.5 text-[11px] text-text-secondary">
            {plan.status === 'ready_for_review'
              ? 'Ready to review'
              : plan.status === 'building'
                ? 'Building…'
                : 'Approved'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <button
            type="button"
            className="rounded border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
            disabled={approveDisabled}
            onClick={onReject}
          >
            Reject
          </button>
          {showApprove ? (
            <button
              type="button"
              className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              disabled={approveDisabled}
              onClick={onApprove}
            >
              Approve
            </button>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-sm text-text-primary">
        {editable ? (
          <>
            <label className="mb-3 block">
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-text-muted">Summary</span>
              <textarea
                className={`${field} min-h-[4rem]`}
                value={plan.summary}
                onChange={(event) => patch({ summary: event.target.value })}
              />
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-text-muted">Steps</span>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => patch({ steps: [...plan.steps, ''] })}
                >
                  Add step
                </button>
              </div>
              {plan.steps.length ? (
                <ol className="list-decimal space-y-2 pl-5">
                  {plan.steps.map((step, index) => (
                    <li key={index} className="pl-1">
                      <div className="flex gap-2">
                        <textarea
                          className={`${field} min-h-[2.5rem] flex-1`}
                          value={step}
                          onChange={(event) => {
                            const steps = [...plan.steps];
                            steps[index] = event.target.value;
                            patch({ steps });
                          }}
                        />
                        <button
                          type="button"
                          className="shrink-0 self-start text-xs text-text-muted hover:text-error"
                          aria-label={`Remove step ${index + 1}`}
                          onClick={() => patch({ steps: plan.steps.filter((_, i) => i !== index) })}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-text-secondary">No steps yet. Add one or Approve with summary only.</p>
              )}
            </div>
          </>
        ) : (
          <>
            {plan.summary ? <p className="mb-3 text-text-secondary">{plan.summary}</p> : null}
            {plan.steps.length ? (
              <ol className="list-decimal space-y-2 pl-5">
                {plan.steps.map((step, index) => (
                  <li key={`${index}-${step.slice(0, 24)}`}>{step}</li>
                ))}
              </ol>
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm">{plan.markdown}</pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}
