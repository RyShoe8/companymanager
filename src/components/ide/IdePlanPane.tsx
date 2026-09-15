'use client';

import type { IdePlanDocument } from '@/lib/ide/idePlan';

type Props = {
  plan: IdePlanDocument;
  onApprove: () => void;
  approveDisabled?: boolean;
};

export default function IdePlanPane({ plan, onApprove, approveDisabled }: Props) {
  const showApprove = plan.status === 'ready_for_review';

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-sm">
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">{plan.title}</p>
          <p className="truncate text-[11px] text-text-secondary">
            {plan.status === 'ready_for_review'
              ? 'Ready to review'
              : plan.status === 'building'
                ? 'Building…'
                : 'Approved'}
          </p>
        </div>
        {showApprove ? (
          <button
            type="button"
            className="shrink-0 rounded bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            disabled={approveDisabled}
            onClick={onApprove}
          >
            Approve
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-sm text-text-primary">
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
      </div>
    </div>
  );
}
