'use client';

import { useState } from 'react';
import { IClient } from '@/lib/models/Client';
import { IProject } from '@/lib/models/Project';
import { filterContributableProjects } from '@/lib/utils/projectTeam';

type PickerTab = 'client' | 'project';

export interface MultiLinkTargetPickerProps {
  clients: IClient[];
  projects: IProject[];
  selectedClientIds: string[];
  selectedProjectIds: string[];
  onToggleClient: (id: string) => void;
  onToggleProject: (id: string) => void;
  currentUserEmployeeId?: string | null;
  isManagerOrAdmin: boolean;
  /** Tighter max heights when embedded in a meeting row. */
  compact?: boolean;
}

function clientNameForProject(project: IProject, clients: IClient[]): string | null {
  if (!project.clientId) return null;
  const id = project.clientId.toString();
  return clients.find((c) => c._id?.toString() === id)?.name ?? null;
}

export default function MultiLinkTargetPicker({
  clients,
  projects,
  selectedClientIds,
  selectedProjectIds,
  onToggleClient,
  onToggleProject,
  currentUserEmployeeId,
  isManagerOrAdmin,
  compact = false,
}: MultiLinkTargetPickerProps) {
  const [tab, setTab] = useState<PickerTab>('client');

  const eligible = filterContributableProjects(
    projects,
    currentUserEmployeeId ?? null,
    isManagerOrAdmin
  );

  const listMaxH = compact ? 'max-h-28' : 'max-h-[min(50vh,360px)]';

  const clientTabLabel =
    selectedClientIds.length > 0 ? `Client (${selectedClientIds.length})` : 'Client';
  const projectTabLabel =
    selectedProjectIds.length > 0 ? `Project (${selectedProjectIds.length})` : 'Project';

  return (
    <div>
      <div className="flex gap-1 p-1 mb-3 rounded-lg bg-background-elevated border border-border">
        <button
          type="button"
          onClick={() => setTab('client')}
          className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'client'
              ? 'bg-background-card text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {clientTabLabel}
        </button>
        <button
          type="button"
          onClick={() => setTab('project')}
          className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'project'
              ? 'bg-background-card text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {projectTabLabel}
        </button>
      </div>

      {tab === 'client' ? (
        clients.length === 0 ? (
          <p className="text-sm text-text-secondary">No clients available.</p>
        ) : (
          <ul className={`divide-y divide-border ${listMaxH} overflow-y-auto px-1`}>
            {clients.map((client) => {
              const id = client._id?.toString() ?? '';
              const selected = selectedClientIds.includes(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onToggleClient(id)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-lg transition-colors ${
                      selected
                        ? 'bg-primary/15 ring-1 ring-inset ring-primary/40'
                        : 'hover:bg-background-elevated'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: client.color || '#3b82f6' }}
                    />
                    <span className="font-medium text-text-primary truncate flex-1">{client.name}</span>
                    {selected && (
                      <span className="text-xs text-primary shrink-0" aria-hidden>
                        ✓
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : eligible.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No projects available. You need to be assigned to a project to link one.
        </p>
      ) : (
        <ul className={`divide-y divide-border ${listMaxH} overflow-y-auto px-1`}>
          {eligible.map((project) => {
            const id = project._id.toString();
            const selected = selectedProjectIds.includes(id);
            const clientName = clientNameForProject(project, clients);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onToggleProject(id)}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-lg transition-colors ${
                    selected
                      ? 'bg-primary/15 ring-1 ring-inset ring-primary/40'
                      : 'hover:bg-background-elevated'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: project.color || '#3b82f6' }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-text-primary truncate block">{project.name}</span>
                    {clientName ? (
                      <span className="text-xs text-text-secondary truncate block">{clientName}</span>
                    ) : null}
                  </div>
                  {selected && (
                    <span className="text-xs text-primary shrink-0" aria-hidden>
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
