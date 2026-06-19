'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { IClient } from '@/lib/models/Client';
import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { IEmployee } from '@/lib/models/Employee';
import { getTimeframeRange, type TimeframeType } from '@/lib/utils/dateUtils';
import EditableText from '@/components/ui/EditableText';
import EditableSelect from '@/components/ui/EditableSelect';
import ClientLogo from '@/components/clients/ClientLogo';
import ClientOperationsPanel from '@/components/workspace/ClientOperationsPanel';
import ClientImpactReportModal from '@/components/workspace/ClientImpactReportModal';
import InsightsPanel from '@/components/insights/InsightsPanel';
import InlineProjectView from '@/components/planning-map/InlineProjectView';
import CollapsibleInspectorSection from '@/components/ui/CollapsibleInspectorSection';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';
import {
  activeClientProjects,
  clientHubProject,
} from '@/lib/clients/clientProjectHelpers';
import { getProjectCardHeaderTextClass } from '@/lib/utils/colorContrast';
import {
  countActiveContentForDisplayInRange,
  countActiveTasksForDisplayInRange,
} from '@/lib/workspace/projectDisplayCounts';
import Image from 'next/image';
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
  contentItems = [],
}: InlineClientViewProps) {
  const [localClient, setLocalClient] = useState(client);
  const [logo, setLogo] = useState(client.logo);
  const [showImpactReport, setShowImpactReport] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const light = useInspectorLight();

  useEffect(() => {
    setLocalClient(client);
    setLogo(client.logo);
  }, [client]);

  const clientId = String(client._id);
  const adminProject = useMemo(() => clientHubProject(projects), [projects, clientId]);
  const activeProjects = useMemo(() => activeClientProjects(projects), [projects]);
  const timeframeRange = useMemo(
    () => getTimeframeRange(timeframe, referenceDate ?? new Date()),
    [timeframe, referenceDate]
  );

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
      <div className={`rounded-lg p-4 border ${lightSurface('bg-white border-gray-200', 'dark:bg-gray-800 dark:border-gray-700', light)}`}>
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
              className={`text-xl font-bold block w-full ${lightSurface('text-gray-900', 'dark:text-white', light)}`}
              placeholder="Client name"
              disabled={!isManagerOrAdmin}
            />
            <EditableText
              value={localClient.description || ''}
              onSave={(v) => handleClientFieldUpdate({ description: v })}
              className={`mt-1 block w-full ${lightSurface('text-gray-600', 'dark:text-gray-300', light)}`}
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
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${lightSurface('bg-white border-gray-200 text-gray-900 hover:bg-gray-50', 'dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600', light)}`}
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
      )}

      <CollapsibleInspectorSection
        id="inspector-client-projects-section"
        title="Active Projects"
        titleSuffix={
          <span className={`text-sm font-normal ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}>
            ({activeProjects.length})
          </span>
        }
        collapsedSummary={`${activeProjects.length} active`}
        expanded={projectsExpanded}
        onToggle={() => setProjectsExpanded((v) => !v)}
      >
        {activeProjects.length === 0 ? (
          <p className={`text-sm ${lightSurface('text-gray-500', 'dark:text-gray-400', light)}`}>
            No active projects for this client.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeProjects.map((project) => {
              const displayColor = project.status === 'in-review' ? '#ef4444' : project.color || '#3b82f6';
              const headerTextClass = getProjectCardHeaderTextClass(displayColor);
              const activeTaskCount = countActiveTasksForDisplayInRange(
                project,
                contentItems,
                timeframeRange.start,
                timeframeRange.end,
                referenceDate ?? new Date()
              );
              const activeContentCount = countActiveContentForDisplayInRange(
                project,
                contentItems,
                timeframeRange.start,
                timeframeRange.end,
                referenceDate ?? new Date()
              );
              const totalTasks = project.tasks?.length ?? 0;
              const completedTasks = project.tasks?.filter((t) => t.status === 'completed').length ?? 0;
              const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

              return (
                <button
                  key={String(project._id)}
                  type="button"
                  onClick={() => onViewProject(project)}
                  className="text-left p-4 rounded-lg border-2 border-border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg relative w-full"
                  style={{
                    backgroundColor: `${displayColor}F0`,
                    borderColor: displayColor,
                  }}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold overflow-hidden shrink-0 ${project.logo ? '' : headerTextClass}`}
                      style={project.logo ? undefined : { backgroundColor: displayColor }}
                    >
                      {project.logo ? (
                        <Image src={project.logo} alt="" width={32} height={32} className="w-full h-full object-cover" unoptimized />
                      ) : (
                        project.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className={`font-bold truncate block ${headerTextClass}`}>{project.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pr-2 mt-1">
                    <div className={`relative h-1 flex-1 rounded-full overflow-hidden ${headerTextClass}`}>
                      <div className="absolute inset-0 bg-white opacity-20" />
                      <div
                        className="relative h-full transition-all duration-500"
                        style={{ width: `${progressPercent}%`, backgroundColor: 'currentColor' }}
                      />
                    </div>
                    <span className={`text-[10px] font-bold ${headerTextClass} shrink-0`}>{progressPercent}%</span>
                  </div>
                  <div className={`flex flex-wrap gap-2 text-xs font-medium mt-2 ${headerTextClass}`}>
                    <span>{activeTaskCount} active task{activeTaskCount === 1 ? '' : 's'}</span>
                    <span>{activeContentCount} active content</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CollapsibleInspectorSection>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className={`text-sm px-3 py-1.5 rounded transition-colors ${lightSurface('text-gray-600 hover:text-gray-900 hover:bg-gray-100', 'dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700', light)}`}
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
