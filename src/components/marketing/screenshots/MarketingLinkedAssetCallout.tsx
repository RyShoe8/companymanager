'use client';

import { MARKETING_LINKED_ASSET_EXAMPLES } from '@/lib/marketing/marketingFixtures';

export default function MarketingLinkedAssetCallout() {
  return (
    <div className="rounded-xl border border-border bg-background-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-3">
        Linked where you work
      </p>
      <div className="space-y-2">
        {MARKETING_LINKED_ASSET_EXAMPLES.map((row) => (
          <div
            key={row.label}
            className="flex flex-wrap items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 bg-background"
          >
            <span className="font-medium text-text-primary">{row.label}</span>
            <span className="text-text-muted" aria-hidden>
              →
            </span>
            <span className="text-text-secondary">{row.target}</span>
            <span className="ml-auto text-xs rounded-full border border-border px-2 py-0.5 text-text-muted">
              {row.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
