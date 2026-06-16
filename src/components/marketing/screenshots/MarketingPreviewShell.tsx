'use client';

import type { ReactNode } from 'react';
import { InspectorLightProvider } from '@/contexts/InspectorLightContext';
import type { LensType, PhaseType } from '@/lib/hooks/useWorkspaceData';
import type { TimeframeType } from '@/lib/utils/dateUtils';
import MarketingWorkspaceHeader from '@/components/marketing/screenshots/MarketingWorkspaceHeader';
import { cn } from '@/lib/utils';

type MarketingPreviewShellProps = {
  children: ReactNode;
  phase: PhaseType;
  lens?: LensType;
  timeframe?: TimeframeType;
  showLensRow?: boolean;
  showTasks?: boolean;
  showContent?: boolean;
  showMeetings?: boolean;
  contentChannelFilter?: string;
  inspectorLight?: boolean;
  className?: string;
  bodyClassName?: string;
  minHeight?: string;
};

export default function MarketingPreviewShell({
  children,
  phase,
  lens,
  timeframe,
  showLensRow,
  showTasks,
  showContent,
  showMeetings,
  contentChannelFilter,
  inspectorLight = false,
  className,
  bodyClassName,
  minHeight = 'min-h-[320px]',
}: MarketingPreviewShellProps) {
  const inner = (
    <div
      className={cn(
        'bg-background text-text-primary pointer-events-none select-none overflow-hidden',
        minHeight,
        className
      )}
      aria-hidden
    >
      <div className="px-3 sm:px-4 pt-3 pb-2">
        <MarketingWorkspaceHeader
          phase={phase}
          lens={lens}
          timeframe={timeframe}
          showLensRow={showLensRow}
          showTasks={showTasks}
          showContent={showContent}
          showMeetings={showMeetings}
          contentChannelFilter={contentChannelFilter}
        />
      </div>
      <div className={cn('px-3 sm:px-4 pb-3 max-h-[420px] overflow-hidden', bodyClassName)}>{children}</div>
    </div>
  );

  if (inspectorLight) {
    return (
      <div className="inspector-light">
        <InspectorLightProvider>{inner}</InspectorLightProvider>
      </div>
    );
  }

  return inner;
}
