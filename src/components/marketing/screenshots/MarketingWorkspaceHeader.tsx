'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import PhaseFilter from '@/components/workspace/PhaseFilter';
import LensBar from '@/components/workspace/LensBar';
import TimeHorizonSelector from '@/components/planning-map/TimeHorizonSelector';
import WorkspaceLensToolbar from '@/components/workspace/WorkspaceLensToolbar';
import Toggle from '@/components/ui/Toggle';
import ContentChannelFilter from '@/components/workspace/ContentChannelFilter';
import type { LensType, PhaseType } from '@/lib/hooks/useWorkspaceData';
import type { TimeframeType } from '@/lib/utils/dateUtils';
import { MARKETING_ORG_NAME } from '@/lib/marketing/marketingFixtures';
import { cn } from '@/lib/utils';

const noop = () => {};

type MarketingWorkspaceHeaderProps = {
  phase: PhaseType;
  lens?: LensType;
  timeframe?: TimeframeType;
  showLensRow?: boolean;
  showTasks?: boolean;
  showContent?: boolean;
  showMeetings?: boolean;
  contentChannelFilter?: string;
  className?: string;
};

export default function MarketingWorkspaceHeader({
  phase,
  lens = 'schedule',
  timeframe = 'weekly',
  showLensRow = true,
  showTasks = true,
  showContent = true,
  showMeetings = true,
  contentChannelFilter = 'All',
  className,
}: MarketingWorkspaceHeaderProps) {
  const isSchedulingPhase = phase === 'Schedule';

  return (
    <div className={cn('pointer-events-none select-none mb-3', className)}>
      <div className="flex flex-row items-center gap-3 flex-wrap lg:flex-nowrap mb-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Image
            src="/images/nucleas-logo.png"
            alt=""
            width={40}
            height={40}
            className="rounded-lg shrink-0"
          />
          <span className="text-xl sm:text-2xl font-bold text-white truncate">{MARKETING_ORG_NAME}</span>
        </div>
        <PhaseFilter selected={phase} onSelect={noop} />
        <TimeHorizonSelector selected={timeframe} onSelect={noop} />
      </div>

      {showLensRow && !isSchedulingPhase && (
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <LensBar selected={lens} onSelect={noop} />
          {(lens === 'schedule' || lens === 'agenda') && (
            <WorkspaceLensToolbar className="ml-auto">
              <Toggle label="Show Tasks" checked={showTasks} onChange={noop} />
              <Toggle label="Show Content" checked={showContent} onChange={noop} />
              {lens === 'agenda' ? (
                <Toggle label="Show Meetings" checked={showMeetings} onChange={noop} />
              ) : null}
              <ContentChannelFilter value={contentChannelFilter} onChange={noop} />
            </WorkspaceLensToolbar>
          )}
        </div>
      )}
    </div>
  );
}
