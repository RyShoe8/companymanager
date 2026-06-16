'use client';

import AssetCard from '@/components/assets/AssetCard';
import {
  MARKETING_ASSETS,
  MARKETING_CONTENT_ITEMS,
  marketingProjectName,
} from '@/lib/marketing/marketingFixtures';

const LINKED_EXAMPLES = [
  {
    label: 'Homepage hero screenshot',
    target: 'Website Relaunch · Design homepage hero',
    type: 'Task',
  },
  {
    label: 'Launch teaser clip',
    target: 'Q2 Content Push · Product launch announcement',
    type: 'Content',
  },
  {
    label: 'Brand guidelines',
    target: 'Website Relaunch',
    type: 'Project',
  },
];

export default function AssetsPlatformScreenshot() {
  const previewAssets = MARKETING_ASSETS.slice(0, 4);
  const launchContent = MARKETING_CONTENT_ITEMS[0];

  return (
    <div className="bg-background text-text-primary pointer-events-none select-none p-4 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
          Centralized asset library
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {previewAssets.map((asset) => (
            <AssetCard
              key={asset._id.toString()}
              asset={asset}
              linkedProjectId={asset.linkedProjectId?.toString()}
              linkedProjectName={marketingProjectName(asset.linkedProjectId)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-3">
          Linked across your platform
        </p>
        <div className="space-y-3">
          {LINKED_EXAMPLES.map((row) => (
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
        <p className="text-xs text-text-muted mt-3">
          One repository for screenshots, recordings, and docs — connected to{' '}
          {launchContent.title.toLowerCase()} and every project you run.
        </p>
      </div>
    </div>
  );
}
