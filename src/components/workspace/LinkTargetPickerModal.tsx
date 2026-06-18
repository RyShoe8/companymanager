'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { IClient } from '@/lib/models/Client';
import { IProject } from '@/lib/models/Project';
import { filterContributableProjects } from '@/lib/utils/projectTeam';
import { resolveClientHubProject } from '@/lib/clients/resolveClientHubProject';

type PickerTab = 'client' | 'project';

interface LinkTargetPickerModalProps {
  isOpen: boolean;
  title: string;
  clients: IClient[];
  projects: IProject[];
  currentUserEmployeeId?: string | null;
  isManagerOrAdmin: boolean;
  onSelectProject: (project: IProject) => void;
  onClose: () => void;
}

function clientNameForProject(project: IProject, clients: IClient[]): string | null {
  if (!project.clientId) return null;
  const id = project.clientId.toString();
  return clients.find((c) => c._id?.toString() === id)?.name ?? null;
}

export default function LinkTargetPickerModal({
  isOpen,
  title,
  clients,
  projects,
  currentUserEmployeeId,
  isManagerOrAdmin,
  onSelectProject,
  onClose,
}: LinkTargetPickerModalProps) {
  const [tab, setTab] = useState<PickerTab>('client');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const eligible = filterContributableProjects(projects, currentUserEmployeeId ?? null, isManagerOrAdmin);

  const handleClose = () => {
    setSelectedClientId(null);
    setClientError(null);
    onClose();
  };

  const handleClientConfirm = () => {
    if (!selectedClientId) {
      setClientError('Select a client to continue.');
      return;
    }
    const hub = resolveClientHubProject(selectedClientId, projects);
    if (!hub) {
      setClientError('No hub project for this client — contact admin.');
      return;
    }
    setClientError(null);
    setSelectedClientId(null);
    onSelectProject(hub);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} maxWidth="sm">
      <div className="flex gap-1 p-1 mb-4 rounded-lg bg-background-elevated border border-border">
        <button
          type="button"
          onClick={() => {
            setTab('client');
            setClientError(null);
          }}
          className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'client'
              ? 'bg-background-card text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Client
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('project');
            setClientError(null);
          }}
          className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'project'
              ? 'bg-background-card text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Project
        </button>
      </div>

      {tab === 'client' ? (
        <div className="space-y-4">
          {clients.length === 0 ? (
            <p className="text-sm text-text-secondary">No clients available. Create a client first.</p>
          ) : (
            <>
              <ul className="divide-y divide-border max-h-[min(50vh,360px)] overflow-y-auto -mx-1">
                {clients.map((client) => {
                  const id = client._id?.toString() ?? '';
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClientId(id);
                          setClientError(null);
                        }}
                        className={`w-full text-left px-3 py-3 flex items-center gap-3 rounded-lg transition-colors ${
                          selectedClientId === id
                            ? 'bg-primary/10 ring-1 ring-primary/30'
                            : 'hover:bg-background-elevated'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: client.color || '#3b82f6' }}
                        />
                        <span className="font-medium text-text-primary truncate">{client.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {clientError && (
                <p className="text-sm text-error">{clientError}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleClientConfirm} disabled={!selectedClientId}>
                  Continue
                </Button>
              </div>
            </>
          )}
        </div>
      ) : eligible.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No projects available. You need to be assigned to a project to continue.
        </p>
      ) : (
        <ul className="divide-y divide-border max-h-[min(60vh,420px)] overflow-y-auto -mx-1">
          {eligible.map((project) => {
            const clientName = clientNameForProject(project, clients);
            return (
              <li key={project._id.toString()}>
                <button
                  type="button"
                  onClick={() => onSelectProject(project)}
                  className="w-full text-left px-3 py-3 flex items-center gap-3 rounded-lg hover:bg-background-elevated transition-colors"
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: project.color || '#3b82f6' }}
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-text-primary truncate block">{project.name}</span>
                    {clientName ? (
                      <span className="text-xs text-text-secondary truncate block">{clientName}</span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
