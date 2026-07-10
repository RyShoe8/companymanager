'use client';

import Toggle from '@/components/ui/Toggle';
import WorkspaceEmailDigestSelect from '@/components/workspace/WorkspaceEmailDigestSelect';
import WorkspaceTeamFilter, { type TeamFilterType } from '@/components/workspace/WorkspaceTeamFilter';
import type { LensType } from '@/lib/hooks/useWorkspaceData';

export type WorkspaceViewOptionsProps = {
  lens: LensType;
  isManagerOrAdmin: boolean;
  showOnlyMyAssignments: boolean;
  onShowOnlyMyAssignmentsChange: (v: boolean) => void;
  showTasks: boolean;
  onShowTasksChange: (v: boolean) => void;
  showContent: boolean;
  onShowContentChange: (v: boolean) => void;
  showMeetings: boolean;
  onShowMeetingsChange: (v: boolean) => void;
  teamFilter: TeamFilterType;
  onTeamFilterChange: (v: TeamFilterType) => void;
  emailDigestLayout?: 'inline' | 'stacked';
  onEmailDigestIntervalChange?: (interval: string) => void;
};

export default function WorkspaceViewOptions({
  lens,
  isManagerOrAdmin,
  showOnlyMyAssignments,
  onShowOnlyMyAssignmentsChange,
  showTasks,
  onShowTasksChange,
  showContent,
  onShowContentChange,
  showMeetings,
  onShowMeetingsChange,
  teamFilter,
  onTeamFilterChange,
  emailDigestLayout = 'inline',
  onEmailDigestIntervalChange,
}: WorkspaceViewOptionsProps) {
  const showLensToggles =
    lens === 'schedule' || lens === 'agenda' || lens === 'clients';

  const assignmentsToggle = isManagerOrAdmin ? (
    <Toggle
      label="Show only my assignments"
      checked={showOnlyMyAssignments}
      onChange={onShowOnlyMyAssignmentsChange}
    />
  ) : null;

  const lensToggleBlock = showLensToggles ? (
    <>
      {lens !== 'agenda' ? (
        <>
          <Toggle label="Show Tasks" checked={showTasks} onChange={onShowTasksChange} />
          <Toggle label="Show Content" checked={showContent} onChange={onShowContentChange} />
        </>
      ) : null}
      {lens === 'agenda' ? (
        <Toggle label="Show Meetings" checked={showMeetings} onChange={onShowMeetingsChange} />
      ) : null}
      {lens !== 'clients' ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">Team filter</span>
          <WorkspaceTeamFilter value={teamFilter} onChange={onTeamFilterChange} className="w-full" />
        </div>
      ) : null}
    </>
  ) : null;

  if (emailDigestLayout === 'stacked') {
    return (
      <div className="space-y-4" data-tour="lens-toggles">
        <div className="space-y-3">
          {assignmentsToggle}
          {lensToggleBlock}
        </div>
        <div className="pt-3 border-t border-border">
          <WorkspaceEmailDigestSelect
            layout={emailDigestLayout}
            onIntervalChange={onEmailDigestIntervalChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-tour="lens-toggles">
      {assignmentsToggle}

      <WorkspaceEmailDigestSelect
        layout={emailDigestLayout}
        onIntervalChange={onEmailDigestIntervalChange}
      />

      {showLensToggles ? (
        <div className="space-y-3 pt-1 border-t border-border">{lensToggleBlock}</div>
      ) : null}
    </div>
  );
}

export function countActiveViewOptions(
  props: Pick<
    WorkspaceViewOptionsProps,
    | 'lens'
    | 'isManagerOrAdmin'
    | 'showOnlyMyAssignments'
    | 'showTasks'
    | 'showContent'
    | 'showMeetings'
    | 'teamFilter'
  > & { emailDigestInterval?: string }
): number {
  let count = 0;
  if (props.isManagerOrAdmin && props.showOnlyMyAssignments) count++;
  if (props.emailDigestInterval && props.emailDigestInterval !== 'off') count++;
  if (props.lens === 'schedule' || props.lens === 'clients') {
    if (props.showTasks) count++;
    if (props.showContent) count++;
  }
  if (props.lens === 'agenda' && !props.showMeetings) count++;
  if (props.lens !== 'clients' && props.teamFilter !== 'All Teams') count++;
  return count;
}
