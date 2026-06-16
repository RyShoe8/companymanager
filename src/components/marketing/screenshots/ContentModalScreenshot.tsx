'use client';

import ContentItemFormFields from '@/components/planning-map/ContentItemFormFields';
import ContentTargetingSection from '@/components/planning-map/ContentTargetingSection';
import {
  MARKETING_EMPLOYEES,
  marketingContentDetailDefaults,
} from '@/lib/marketing/marketingFixtures';

const noop = () => {};
const defaults = marketingContentDetailDefaults();

export default function ContentModalScreenshot() {
  return (
    <div className="bg-background text-text-primary pointer-events-none select-none">
      <div className="max-h-[480px] overflow-hidden rounded-lg border border-border bg-background-card shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Content item</p>
            <h3 className="text-lg font-semibold text-text-primary mt-0.5">{defaults.title}</h3>
          </div>
          <span className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary">
            {defaults.project.name}
          </span>
        </div>
        <div className="p-5 space-y-4 max-h-[400px] overflow-hidden">
          <ContentItemFormFields
            title={defaults.title}
            onTitleChange={noop}
            distributionMethods={defaults.distributionMethods}
            onToggleDistribution={noop}
            channel={defaults.channel}
            onChannelChange={noop}
            status={defaults.status}
            onStatusChange={noop}
            publishDate={defaults.publishDate}
            onPublishDateChange={noop}
            notes={defaults.notes}
            onNotesChange={noop}
            assignedToEmployeeId={defaults.assignedToEmployeeId}
            onAssignedToEmployeeIdChange={noop}
            assigneeOptions={MARKETING_EMPLOYEES}
            estimatedHours={defaults.estimatedHours}
            onEstimatedHoursChange={noop}
          />
          <ContentTargetingSection
            project={defaults.project}
            isManagerOrAdmin
            expanded
            onToggle={noop}
            keywords={defaults.keywords}
            onKeywordsChange={noop}
            internalLinks={defaults.internalLinks}
            onInternalLinksChange={noop}
            externalUrl={defaults.externalUrl}
            onExternalUrlChange={noop}
            mode="draft"
          />
        </div>
      </div>
    </div>
  );
}
