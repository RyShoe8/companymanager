'use client';

import { useMemo, useRef, useCallback, type RefObject } from 'react';
import BottomSheet from '@/components/ui/BottomSheet';
import InlineProjectView from '@/components/planning-map/InlineProjectView';
import InlineClientView from '@/components/workspace/InlineClientView';
import { IProject } from '@/lib/models/Project';
import { IClient } from '@/lib/models/Client';
import { IEmployee } from '@/lib/models/Employee';
import { IContentItem } from '@/lib/models/ContentItem';
import type { TimeframeType } from '@/lib/utils/dateUtils';
import { projectSaveErrorMessage } from '@/lib/utils/projectSaveError';
import { InspectorLightProvider } from '@/contexts/InspectorLightContext';

export type FocusType = 'project' | 'task' | 'client';

interface InspectorHostProps {
    focusId: string | null;
    onClose: () => void;
    projects: IProject[];
    employees: IEmployee[];
    isManagerOrAdmin: boolean;
    currentUserEmployeeId?: string;
    currentUserId?: string;
    onRefresh: () => void;
    onProjectPatched?: (project: IProject) => void;
    onUpdateClient?: (clientId: string, updates: Partial<IClient> & Record<string, unknown>) => Promise<void> | void;
    onViewProject?: (project: IProject) => void;
    initialOpenTaskIndex?: number | null;
    onInitialOpenTaskConsumed?: () => void;
    initialOpenContentId?: string | null;
    onInitialOpenContentConsumed?: () => void;
    scrollContainerRef?: RefObject<HTMLDivElement | null>;
    autoAddTaskOnOpen?: boolean;
    onAutoAddTaskConsumed?: () => void;
    clients?: IClient[];
    initialAddContentOpen?: boolean;
    initialAddContentDate?: Date;
    initialAddContentPrefill?: { title?: string; channel?: string; notes?: string };
    onAddContentOpenConsumed?: () => void;
    onContentItemClick?: (item: IContentItem) => void;
    contentRefreshTrigger?: number;
    onContentListChanged?: () => void;
    contentItems?: IContentItem[];
    timeframe?: TimeframeType;
    referenceDate?: Date;
    initialTasksExpanded?: boolean;
    initialContentExpanded?: boolean;
    itemSeenRefreshTrigger?: number;
    onAddProject?: () => void;
}

export default function InspectorHost({
    focusId,
    onClose,
    projects,
    employees,
    isManagerOrAdmin,
    currentUserEmployeeId,
    currentUserId,
    onRefresh,
    onProjectPatched,
    onUpdateClient,
    onViewProject,
    initialOpenTaskIndex,
    onInitialOpenTaskConsumed,
    initialOpenContentId,
    onInitialOpenContentConsumed,
    scrollContainerRef: scrollContainerRefProp,
    autoAddTaskOnOpen,
    onAutoAddTaskConsumed,
    clients = [],
    initialAddContentOpen,
    initialAddContentDate,
    initialAddContentPrefill,
    onAddContentOpenConsumed,
    onContentItemClick,
    contentRefreshTrigger,
    onContentListChanged,
    contentItems = [],
    timeframe = 'weekly',
    referenceDate,
    initialTasksExpanded = false,
    initialContentExpanded = false,
    itemSeenRefreshTrigger,
    onAddProject,
}: InspectorHostProps) {
    const internalScrollRef = useRef<HTMLDivElement | null>(null);
    const scrollContainerRef = scrollContainerRefProp ?? internalScrollRef;

    const { type, id } = useMemo(() => {
        if (!focusId) return { type: null, id: null };
        const parts = focusId.split(':');
        return { type: parts[0] as FocusType, id: parts[1] };
    }, [focusId]);

    const focusedProject = useMemo(() => {
        if (type === 'project' && id) {
            return projects.find((p) => p._id.toString() === id);
        }
        return null;
    }, [type, id, projects]);

    const focusedClient = useMemo(() => {
        if (type === 'client' && id) {
            return clients.find((c) => c._id.toString() === id) ?? null;
        }
        return null;
    }, [type, id, clients]);

    const clientProjects = useMemo(() => {
        if (!focusedClient) return [];
        const clientId = focusedClient._id.toString();
        return projects.filter((p) => String(p.clientId) === clientId);
    }, [focusedClient, projects]);

    const focusedProjectId = focusedProject?._id.toString() ?? null;

    const handleProjectUpdate = useCallback(
        async (updates: Partial<IProject> & { allowBulkTaskExpand?: boolean }) => {
            if (!focusedProjectId || !updates || Object.keys(updates).length === 0) return;
            const res = await fetch(`/api/projects/${focusedProjectId}`, {
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
        },
        [focusedProjectId, onProjectPatched, onRefresh]
    );

    const handleProjectDelete = useCallback(async () => {
        if (!focusedProjectId) return;
        const res = await fetch(`/api/projects/${focusedProjectId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete project');
        onRefresh();
        onClose();
    }, [focusedProjectId, onRefresh, onClose]);

    const renderInnerContent = () => {
        if (type === 'client' && focusedClient && onUpdateClient && onViewProject) {
            return (
                <div className="inspector-light w-full max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 border border-border rounded-t-2xl bg-white" data-tour="client-inspector">
                    <InspectorLightProvider>
                        <InlineClientView
                            client={focusedClient}
                            projects={clientProjects}
                            allProjects={projects}
                            employees={employees}
                            isManagerOrAdmin={isManagerOrAdmin}
                            currentUserId={currentUserId}
                            currentUserEmployeeId={currentUserEmployeeId}
                            onUpdateClient={onUpdateClient}
                            onViewProject={onViewProject}
                            onClose={onClose}
                            onRefresh={onRefresh}
                            onProjectPatched={onProjectPatched}
                            onContentItemClick={onContentItemClick}
                            contentRefreshTrigger={contentRefreshTrigger}
                            onContentListChanged={onContentListChanged}
                            contentItems={contentItems}
                            autoAddTaskOnOpen={autoAddTaskOnOpen}
                            onAutoAddTaskConsumed={onAutoAddTaskConsumed}
                            initialAddContentOpen={initialAddContentOpen}
                            initialAddContentDate={initialAddContentDate}
                            onAddContentOpenConsumed={onAddContentOpenConsumed}
                            timeframe={timeframe}
                            referenceDate={referenceDate}
                            onAddProject={onAddProject}
                        />
                    </InspectorLightProvider>
                </div>
            );
        }

        if (type === 'project' && focusedProject) {
            return (
                <div className="inspector-light w-full max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 border border-border rounded-t-2xl bg-white" data-tour="project-inspector">
                    <InspectorLightProvider>
                    <InlineProjectView
                        project={focusedProject}
                        clients={clients}
                        employees={employees}
                        isManagerOrAdmin={isManagerOrAdmin}
                        currentUserEmployeeId={currentUserEmployeeId}
                        initialAddContentOpen={initialAddContentOpen}
                        initialAddContentDate={initialAddContentDate}
                        initialAddContentPrefill={initialAddContentPrefill}
                        onAddContentOpenConsumed={onAddContentOpenConsumed}
                        onContentItemClick={onContentItemClick}
                        contentRefreshTrigger={contentRefreshTrigger}
                        onContentListChanged={onContentListChanged}
                        initialOpenTaskIndex={initialOpenTaskIndex ?? null}
                        onInitialOpenTaskConsumed={onInitialOpenTaskConsumed}
                        initialOpenContentId={initialOpenContentId ?? null}
                        onInitialOpenContentConsumed={onInitialOpenContentConsumed}
                        scrollContainerRef={scrollContainerRef}
                        autoAddTaskOnOpen={autoAddTaskOnOpen}
                        onAutoAddTaskConsumed={onAutoAddTaskConsumed}
                        timeframe={timeframe}
                        referenceDate={referenceDate}
                        initialTasksExpanded={initialTasksExpanded}
                        initialContentExpanded={initialContentExpanded}
                        itemSeenRefreshTrigger={itemSeenRefreshTrigger}
                        onProjectPatched={onProjectPatched}
                        onUpdate={handleProjectUpdate}
                        onDelete={handleProjectDelete}
                        onClose={onClose}
                        onRefresh={onRefresh}
                    />
                    </InspectorLightProvider>
                </div>
            );
        }

        if (type === 'task' && id) {
            return (
                <div className="p-6 text-center text-gray-400">
                    <p>Task Editor</p>
                    <p className="text-sm mt-2">ID: {id}</p>
                </div>
            );
        }

        return (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center justify-center h-full">
                <svg className="w-12 h-12 mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>Select an item to view details</p>
            </div>
        );
    };

    if (!focusId) return null;

    const isCenteredInspector = type === 'project' || type === 'client';

    return (
        <BottomSheet
            isOpen={!!focusId}
            onClose={onClose}
            title={undefined}
            surface={isCenteredInspector ? 'chrome' : 'card'}
            layout={isCenteredInspector ? 'centeredInspector' : 'bottomSheet'}
            maxHeight="90vh"
            hideCloseButton
            scrollContainerRef={scrollContainerRef}
        >
            <div className={isCenteredInspector ? 'pb-4' : 'pb-8'}>
                {renderInnerContent()}
            </div>
        </BottomSheet>
    );
}
