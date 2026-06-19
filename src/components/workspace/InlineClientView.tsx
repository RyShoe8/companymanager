'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { IClient } from '@/lib/models/Client';
import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { IEmployee } from '@/lib/models/Employee';
import type { TimeframeType } from '@/lib/utils/dateUtils';
import EditableText from '@/components/ui/EditableText';
import EditableSelect from '@/components/ui/EditableSelect';
import ClientLogo from '@/components/clients/ClientLogo';
import ClientOperationsPanel from '@/components/workspace/ClientOperationsPanel';
import ClientImpactReportModal from '@/components/workspace/ClientImpactReportModal';
import InsightsPanel from '@/components/insights/InsightsPanel';
import InlineProjectView from '@/components/planning-map/InlineProjectView';
import CollapsibleInspectorSection from '@/components/ui/CollapsibleInspectorSection';
import {
  activeClientProjects,
  clientHubProject,
} from '@/lib/clients/clientProjectHelpers';
import { projectSaveErrorMessage } from '@/lib/utils/projectSaveError';

interface InlineClientViewProps {
  client: IClient;
  projects: IProject[];
  allProjects: IProject[];
  contentItems?: IContentItem[];
  employees: IEmployee[];
  isManagerOrAdmin: boolean;
  currentUserId?: string;
  currentUserEmployeeId?: string | null;
  onUpdateClient: (clientId: string, updates: Partial<IClient> & Record<string, unknown>) => Promise<void> | void;
  onViewProject: (project: IProject) => void;
  onClose: () => void;
  onRefresh: () => void;
  onProjectPatched?: (project: IProject) => void;
  onContentItemClick?: (item: IContentItem) => void;
  contentRefreshTrigger?: number;
  onContentListChanged?: () => void;
  timeframe?: TimeframeType;
  referenceDate?: Date;
  autoAddTaskOnOpen?: boolean;
  onAutoAddTaskConsumed?: () => void;
  initialAddContentOpen?: boolean;
  initialAddContentDate?: Date;
  onAddContentOpenConsumed?: () => void;
}

export default function InlineClientView({
  client,
  projects,
  allProjects,
  employees,
  isManagerOrAdmin,
  currentUserId,
  currentUserEmployeeId,
  onUpdateClient,
  onViewProject,
  onClose,
  onRefresh,
  onProjectPatched,
  onContentItemClick,
  contentRefreshTrigger,
  onContentListChanged,
  timeframe = 'weekly',
  referenceDate,
  autoAddTaskOnOpen,
  onAutoAddTaskConsumed,
  initialAddContentOpen,
  initialAddContentDate,
  onAddContentOpenConsumed,
}: InlineClientViewProps) {
  const [localClient, setLocalClient] = useState(client);
  const [logo, setLogo] = useState(client.logo);
  const [showImpactReport, setShowImpactReport] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [hqExpanded, setHqExpanded] = useState(true);

  useEffect(() => {
    setLocalClient(client);
    setLogo(client.logo);
  }, [client]);

  const clientId = String(client._id);
  const adminProject = useMemo(() => clientHubProject(projects), [projects, clientId]);
  const activeProjects = useMemo(() => activeClientProjects(projects), [projects]);

  const handleClientFieldUpdate = async (updates: Partial<IClient> & Record<string, unknown>) => {
    setLocalClient((prev) => ({ ...prev, ...updates } as IClient));
    try {
      await onUpdateClient(clientId, updates);
    } catch (error) {
      setLocalClient(client);
      alert(error instanceof Error ? error.message : 'Failed to save client');
    }
  };

  const handleHubUpdate = async (updates: Partial<IProject> & Record<string, unknown>) => {
    if (!adminProject) return;
    const res = await fetch(`/api/projects/${adminProject._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      throw new Error(await projectSaveErrorMessage(res));
    }
    const data = await res.json().catch(() => null);
    if (data && typeof data === 'object' && data._id) {
      onProjectPatched?.(data as IProject);
      return data as IProject;
    }
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-start gap-3">
          <ClientLogo
            clientId={clientId}
            logo={logo}
            color={localClient.color || '#3b82f6'}
            name={localClient.name}
            isManagerOrAdmin={isManagerOrAdmin}
            size="lg"
            onLogoUpdate={setLogo}
          />
          <div className="flex-1 min-w-0">
            <EditableText
              value={localClient.name}
              onSave={(v) => handleClientFieldUpdate({ name: v })}
              className="text-xl font-bold text-gray-900 block w-full"
              placeholder="Client name"
              disabled={!isManagerOrAdmin}
            />
            <EditableText
              value={localClient.description || ''}
              onSave={(v) => handleClientFieldUpdate({ description: v })}
              className="text-gray-600 mt-1 block w-full"
              placeholder="Enter company description"
              autoMultilineAfter={80}
              disabled={!isManagerOrAdmin}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <EditableSelect
                value={localClient.status || 'active'}
                options={[
                  { value: 'active', label: 'Active', color: 'green' },
                  { value: 'lead', label: 'Lead', color: 'yellow' },
                  { value: 'inactive', label: 'Inactive', color: 'gray' },
                ]}
                onSave={(v) => handleClientFieldUpdate({ status: v as IClient['status'] })}
                disabled={!isManagerOrAdmin}
                showColorDot
              />
              <button
                type="button"
                onClick={() => setShowImpactReport(true)}
                className="px-3 py-1.5 bg-background border border-border text-text-primary rounded-md text-xs font-medium hover:bg-background-accent transition-colors"
              >
                Generate Impact Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {isManagerOrAdmin && <InsightsPanel ownerType="client" ownerId={clientId} />}

      <ClientOperationsPanel
        client={localClient}
        projects={projects}
        isManagerOrAdmin={isManagerOrAdmin}
        currentUserId={currentUserId}
        onUpdateClient={async (id, updates) => {
          await onUpdateClient(id, updates);
          setLocalClient((prev) => ({ ...prev, ...updates } as IClient));
        }}
        onViewProject={onViewProject}
      />

      {adminProject && (
        <CollapsibleInspectorSection
          id="inspector-client-hq-section"
          title="Headquarters"
          collapsedSummary="Tasks and content"
          expanded={hqExpanded}
          onToggle={() => setHqExpanded((v) => !v)}
        >
          <InlineProjectView
            project={adminProject}
            employees={employees}
            isManagerOrAdmin={isManagerOrAdmin}
            currentUserEmployeeId={currentUserEmployeeId}
            sectionsOnly="tasks-content"
            onUpdate={handleHubUpdate}
            onProjectPatched={onProjectPatched}
            onClose={onClose}
            onRefresh={onRefresh}
            clients={[localClient]}
            onContentItemClick={onContentItemClick}
            contentRefreshTrigger={contentRefreshTrigger}
            onContentListChanged={onContentListChanged}
            autoAddTaskOnOpen={autoAddTaskOnOpen}
            onAutoAddTaskConsumed={onAutoAddTaskConsumed}
            initialAddContentOpen={initialAddContentOpen}
            initialAddContentDate={initialAddContentDate}
            onAddContentOpenConsumed={onAddContentOpenConsumed}
            timeframe={timeframe}
            referenceDate={referenceDate}
          />
        </CollapsibleInspectorSection>
      )}

      <CollapsibleInspectorSection
        id="inspector-client-projects-section"
        title="Active Projects"
        titleSuffix={
          <span className="text-sm font-normal text-gray-500">({activeProjects.length})</span>
        }
        collapsedSummary={`${activeProjects.length} active`}
        expanded={projectsExpanded}
        onToggle={() => setProjectsExpanded((v) => !v)}
      >
        {activeProjects.length === 0 ? (
          <p className="text-sm text-gray-500">No active projects for this client.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeProjects.map((project) => (
              <button
                key={String(project._id)}
                type="button"
                onClick={() => onViewProject(project)}
                className="text-left rounded-lg border border-gray-200 bg-gray-50 p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color || '#3b82f6' }} />
                  <span className="font-medium text-gray-900 truncate">{project.name}</span>
                </div>
                <p className="text-xs text-gray-500 capitalize">{project.status || 'planning'}</p>
              </button>
            ))}
          </div>
        )}
      </CollapsibleInspectorSection>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="text-sm px-3 py-1.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          Close
        </button>
      </div>

      <ClientImpactReportModal
        isOpen={showImpactReport}
        clientId={clientId}
        clientName={localClient.name}
        onClose={() => setShowImpactReport(false)}
      />
    </div>
  );
}
