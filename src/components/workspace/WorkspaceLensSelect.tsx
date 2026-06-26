'use client';

import WorkspaceFilterSelect from '@/components/workspace/WorkspaceFilterSelect';
import { LensType } from '@/lib/hooks/useWorkspaceData';
import { isFeatureEnabled } from '@/lib/utils/featureFlags';

interface WorkspaceLensSelectProps {
  value: LensType;
  onChange: (value: LensType) => void;
  className?: string;
}

const allLenses: { value: LensType; label: string }[] = [
  { value: 'schedule', label: 'Projects' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'clients', label: 'Clients' },
  { value: 'capacity', label: 'Capacity' },
];

export default function WorkspaceLensSelect({ value, onChange, className = '' }: WorkspaceLensSelectProps) {
  const lenses = allLenses.filter(
    (l) => l.value !== 'agenda' || isFeatureEnabled('agendaViewEnabled')
  );

  return (
    <WorkspaceFilterSelect
      value={value}
      onChange={(e) => onChange(e.target.value as LensType)}
      className={className}
      aria-label="View lens"
      data-tour="lens-bar"
    >
      {lenses.map((lens) => (
        <option key={lens.value} value={lens.value}>
          {lens.label}
        </option>
      ))}
    </WorkspaceFilterSelect>
  );
}
