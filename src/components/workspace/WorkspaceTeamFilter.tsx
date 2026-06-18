'use client';

import WorkspaceFilterSelect from '@/components/workspace/WorkspaceFilterSelect';
import { EmployeeTeam } from '@/lib/models/Employee';

export type TeamFilterType = 'All Teams' | EmployeeTeam;

interface WorkspaceTeamFilterProps {
  value: TeamFilterType;
  onChange: (value: TeamFilterType) => void;
}

const TEAMS: TeamFilterType[] = ['All Teams', 'Development', 'Marketing', 'Testing'];

export default function WorkspaceTeamFilter({ value, onChange }: WorkspaceTeamFilterProps) {
  return (
    <WorkspaceFilterSelect value={value} onChange={(e) => onChange(e.target.value as TeamFilterType)}>
      {TEAMS.map((team) => (
        <option key={team} value={team}>
          {team}
        </option>
      ))}
    </WorkspaceFilterSelect>
  );
}
