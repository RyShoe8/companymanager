'use client';

import { useState, useEffect, useCallback } from 'react';
import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import useWorkspaceData, { PhaseType, LensType } from '@/lib/hooks/useWorkspaceData';
import useIsMobile from '@/lib/hooks/useIsMobile';
import PhaseFilter from '@/components/workspace/PhaseFilter';
import LensBar from '@/components/workspace/LensBar';
import TimeHorizonSelector from '@/components/planning-map/TimeHorizonSelector';
import ScheduleLens from '@/components/workspace/ScheduleLens';
import ProjectsLens from '@/components/workspace/ProjectsLens';
import EmployeeSidebar from '@/components/planning-map/EmployeeSidebar';
import InlineProjectView from '@/components/planning-map/InlineProjectView';
import QuickProjectForm from '@/components/planning-map/QuickProjectForm';
import ContentItemCreateModal from '@/components/planning-map/ContentItemCreateModal';
import CreateMenu from '@/components/workspace/CreateMenu';
import InspectorHost from '@/components/workspace/InspectorHost';
import Modal from '@/components/ui/Modal';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import CommandRegistry from '@/lib/commands/CommandRegistry';
import CommandPalette from '@/components/workspace/CommandPalette';
import VoiceProvider from '@/components/voice/VoiceProvider';
import VoiceOverlay, { VoiceButton } from '@/components/voice/VoiceOverlay';
import { ParsedIntent } from '@/lib/voice/IntentParser';

interface WorkspaceShellProps {
    initialPhase?: PhaseType;
    initialLens?: LensType;
}

export default function WorkspaceShell({
    initialPhase = 'All',
    initialLens = 'schedule',
}: WorkspaceShellProps) {
    const isMobile = useIsMobile();
    const ws = useWorkspaceData(initialPhase, initialLens);

    // Inspector / form state
    const [showProjectForm, setShowProjectForm] = useState(false);
    const [editingProject, setEditingProject] = useState<IProject | undefined>();
    const [addContentProject, setAddContentProject] = useState<IProject | null>(null);
    const [addContentDefaultDate, setAddContentDefaultDate] = useState<Date | undefined>(undefined);

    const [inspectorFocus, setInspectorFocus] = useState<string | null>(null);

    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

    // Handlers
    const handleCreateProject = () => {
        setEditingProject(undefined);
        setShowProjectForm(true);
    };

    const handleViewProject = (project: IProject) => {
        setInspectorFocus(`project:${project._id}`);
    };

    const handleDeleteProject = async (id: string) => {
        try {
            const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
            if (response.ok) {
                setInspectorFocus(null);
                ws.loadData();
            }
        } catch {
            // Error deleting project
        }
    };

    const handleSubmitProject = async (data: Partial<IProject>) => {
        try {
            const url = editingProject ? `/api/projects/${editingProject._id}` : '/api/projects';
            const method = editingProject ? 'PUT' : 'POST';
            const projectData = editingProject ? data : { ...data, status: 'planning' };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData),
            });

            if (response.ok) {
                setShowProjectForm(false);
                setEditingProject(undefined);
                ws.loadData();
            }
        } catch {
            // Error saving project
        }
    };

    // Voice intent execution handler
    const handleIntent = useCallback((intent: ParsedIntent) => {
        if (intent.type === 'NAVIGATE' || intent.type === 'SWITCH_LENS') {
            const place = intent.slots.place || intent.slots.lens;
            if (place === 'schedule') { ws.setLens('schedule'); return { success: true, message: 'Switched to schedule lens' }; }
            if (place === 'projects') { ws.setLens('projects'); return { success: true, message: 'Switched to projects lens' }; }
            if (place === 'capacity' || place === 'employees' || place === 'team') { ws.setLens('capacity'); return { success: true, message: 'Switched to capacity lens' }; }
        }
        if (intent.type === 'FILTER_PHASE') {
            const phase = intent.slots.phase as PhaseType;
            if (['All', 'Plan', 'Build', 'Run'].includes(phase)) {
                ws.setPhase(phase);
                return { success: true, message: `Filtered to ${phase} phase` };
            }
        }
        if (intent.type === 'SET_TIMEFRAME') {
            ws.setTimeframe(intent.slots.timeframe as any);
            return { success: true, message: `Timeframe set to ${intent.slots.timeframe}` };
        }
        if (intent.type === 'SWITCH_VIEW') {
            if (ws.lens === 'schedule') {
                if (intent.slots.mode === 'calendar' || intent.slots.mode === 'agenda') {
                    ws.setScheduleMode(intent.slots.mode as 'calendar' | 'agenda');
                    return { success: true, message: `Switched to ${intent.slots.mode} view` };
                }
            }
        }
        if (intent.type === 'CREATE_CONTENT') {
            setAddContentDefaultDate(new Date());
            setAddContentProject(null); // would need fuzzy matching real project
            return { success: true, message: 'Opening content creation form' };
        }
        if (intent.type === 'TOGGLE_FILTER') {
            if (intent.slots.filter === 'myAssignments') {
                if (!ws.isManagerOrAdmin) return { success: false, message: 'You must be a manager to toggle assignments filter' };
                ws.setShowOnlyMyAssignments(intent.slots.action === 'show');
                return { success: true, message: `${intent.slots.action === 'show' ? 'Showing' : 'Hiding'} only your assignments` };
            }
            if (intent.slots.filter === 'tasks') {
                ws.setShowTasks(intent.slots.action === 'show');
                return { success: true, message: `${intent.slots.action === 'show' ? 'Showing' : 'Hiding'} tasks` };
            }
            if (intent.slots.filter === 'content') {
                ws.setShowContent(intent.slots.action === 'show');
                return { success: true, message: `${intent.slots.action === 'show' ? 'Showing' : 'Hiding'} content` };
            }
        }
        if (intent.type === 'OPEN_ENTITY') {
            const { entityType, name } = intent.slots;
            if (entityType === 'project') {
                const target = ws.allProjects.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
                if (target) {
                    setInspectorFocus(`project:${target._id}`);
                    return { success: true, message: `Opening project: ${target.name}` };
                }
            } else if (entityType === 'content') {
                const target = ws.contentItems.find(c => c.title.toLowerCase().includes(name.toLowerCase()));
                if (target) {
                    setInspectorFocus(`content:${target._id}`);
                    return { success: true, message: `Opening content: ${target.title}` };
                }
            }
            return { success: false, message: `Could not find ${entityType} matching "${name}"` };
        }
        if (intent.type === 'DELETE_ENTITY') {
            const { entityType, name } = intent.slots;
            if (entityType === 'project') {
                const target = ws.allProjects.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
                if (target) {
                    handleDeleteProject(target._id.toString());
                    return { success: true, message: `Deleted project: ${target.name}` };
                }
            }
            return { success: false, message: `Could not find ${entityType} matching "${name}" to delete` };
        }
        if (intent.type === 'COMPLETE_TASK') {
            const { name } = intent.slots;
            // Search all projects for this task
            for (const p of ws.allProjects) {
                const taskIdx = p.tasks?.findIndex(t => t.name.toLowerCase().includes(name.toLowerCase()));
                if (taskIdx !== undefined && taskIdx !== -1) {
                    const task = p.tasks![taskIdx];
                    const updatedTasks = [...p.tasks!];
                    updatedTasks[taskIdx] = { ...task, status: 'completed' };

                    // Fire and forget update
                    fetch(`/api/projects/${p._id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tasks: updatedTasks }),
                    }).then(() => ws.loadData());

                    return { success: true, message: `Marked task "${task.name}" as complete` };
                }
            }
            return { success: false, message: `Could not find task matching "${name}"` };
        }

        return { success: false, message: `Voice action ${intent.type} not fully implemented yet` };
    }, [ws, handleDeleteProject]);

    // Command Palette Registration
    useEffect(() => {
        const commands = [
            {
                id: 'nav-schedule',
                label: 'Go to Schedule',
                category: 'navigate' as const,
                keywords: ['calendar', 'agenda', 'schedule', 'time'],
                execute: () => ws.setLens('schedule'),
            },
            {
                id: 'nav-projects',
                label: 'Go to Projects',
                category: 'navigate' as const,
                keywords: ['list', 'board', 'all', 'projects'],
                execute: () => ws.setLens('projects'),
            },
            {
                id: 'nav-capacity',
                label: 'Go to Capacity',
                category: 'navigate' as const,
                keywords: ['team', 'people', 'workload', 'capacity'],
                execute: () => ws.setLens('capacity'),
            },
            {
                id: 'create-project',
                label: 'Create Project',
                category: 'create' as const,
                keywords: ['new', 'add', 'project'],
                canExecute: () => ws.isManagerOrAdmin,
                execute: handleCreateProject,
            }
        ];

        commands.forEach(c => CommandRegistry.register(c));
        return () => commands.forEach(c => CommandRegistry.unregister(c.id));
    }, [ws, ws.isManagerOrAdmin]);

    // Global keyboard shortcuts
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(open => !open);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    // Default status for new projects depends on phase
    const defaultStatus = ws.phase === 'Build' ? 'in-development' : ws.phase === 'Run' ? 'launched' : 'planning';

    if (ws.loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-text-secondary">Loading...</div>
            </div>
        );
    }

    return (
        <VoiceProvider onIntent={handleIntent}>
            <div className="min-h-screen bg-gray-900 px-4 sm:px-6 lg:px-[100px]">
                <div className="w-full mx-auto pt-[30px] pb-8">
                    {/* ===== Workspace Header ===== */}
                    <div className="mb-4">
                        {/* Row 1: Title + Phase + Timeframe + Actions */}
                        <div className="flex flex-row items-center gap-4 flex-wrap mb-3">
                            <h1 className="text-2xl sm:text-3xl font-bold text-white whitespace-nowrap">
                                Workspace
                            </h1>
                            <PhaseFilter selected={ws.phase} onSelect={ws.setPhase} />
                            <TimeHorizonSelector
                                selected={ws.timeframe}
                                onSelect={(newTimeframe) => {
                                    ws.setTimeframe(newTimeframe);
                                    if (newTimeframe === 'today' && ws.timeframe === 'today') {
                                        ws.setCurrentDate(new Date());
                                    }
                                }}
                            />
                            <div className="flex gap-2 flex-shrink-0 ml-auto items-center">
                                <VoiceButton />
                                <CreateMenu
                                    isManagerOrAdmin={ws.isManagerOrAdmin}
                                    currentUserRole={ws.currentUserRole}
                                    onCreateProject={handleCreateProject}
                                    onCreateContent={() => {
                                        setAddContentProject(null);
                                        setAddContentDefaultDate(new Date());
                                    }}
                                />
                            </div>
                        </div>

                        {/* Row 2: Lens bar + view toggles */}
                        <div className="flex flex-wrap items-center gap-4 justify-between">
                            <LensBar selected={ws.lens} onSelect={ws.setLens} />
                            {ws.lens === 'schedule' && (
                                <div className="flex flex-wrap items-center gap-4">
                                    <Toggle label="Show Tasks" checked={ws.showTasks} onChange={ws.setShowTasks} />
                                    <Toggle
                                        label="Show Content"
                                        checked={ws.showContent}
                                        onChange={ws.setShowContent}
                                    />
                                    <select
                                        value={ws.contentChannelFilter}
                                        onChange={(e) => ws.setContentChannelFilter(e.target.value)}
                                        className="rounded border border-border bg-background-card text-text-primary px-2 py-1 text-sm"
                                    >
                                        <option value="All">All channels</option>
                                        <option value="X">X</option>
                                        <option value="LinkedIn">LinkedIn</option>
                                        <option value="Instagram">Instagram</option>
                                        <option value="TikTok">TikTok</option>
                                        <option value="Email">Email</option>
                                        <option value="Article">Article</option>
                                        <option value="Video">Video</option>
                                        <option value="Reddit">Reddit</option>
                                        <option value="Bluesky">Bluesky</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    {(ws.currentUserRole === 'Manager' || ws.currentUserRole === 'Administrator') && (
                                        <Toggle
                                            label="Show only my assignments"
                                            checked={ws.showOnlyMyAssignments}
                                            onChange={ws.setShowOnlyMyAssignments}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ===== Main Content ===== */}
                    <div className="flex w-full gap-6">
                        <div className="flex-1 min-w-0">
                            {ws.lens === 'schedule' && (
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                    <div className="xl:col-span-2">
                                        <ScheduleLens
                                            projects={ws.filteredProjects}
                                            contentItems={ws.contentItems}
                                            showTasks={ws.showTasks}
                                            showContent={ws.showContent}
                                            contentChannelFilter={ws.contentChannelFilter}
                                            timeframe={ws.timeframe}
                                            currentDate={ws.currentDate}
                                            onProjectClick={handleViewProject}
                                            onDateChange={ws.setCurrentDate}
                                            currentUserEmployeeName={ws.currentUserEmployeeName}
                                            currentUserEmployeeId={ws.currentUserEmployeeId}
                                            isManagerOrAdmin={ws.isManagerOrAdmin}
                                            showOnlyMyAssignments={ws.showOnlyMyAssignments}
                                            onRefreshContent={ws.fetchContentItems}
                                            onAddContent={(project, defaultDate) => {
                                                setAddContentProject(project);
                                                setAddContentDefaultDate(defaultDate);
                                            }}
                                            onContentItemClick={(item) => setInspectorFocus(`content:${item._id}`)}
                                            scheduleMode={ws.scheduleMode}
                                            onScheduleModeChange={ws.setScheduleMode}
                                        />
                                    </div>
                                    <div className="xl:col-span-1">
                                        <EmployeeSidebar
                                            employees={ws.employees}
                                            projects={ws.filteredProjects}
                                            allProjects={ws.allProjects}
                                            timeframe={ws.timeframe}
                                            currentDate={ws.currentDate}
                                            currentUserRole={ws.currentUserRole}
                                            currentUserEmployeeId={ws.currentUserEmployeeId}
                                        />
                                    </div>
                                </div>
                            )}

                            {ws.lens === 'projects' && (
                                <ProjectsLens
                                    projects={ws.filteredProjects}
                                    onProjectClick={handleViewProject}
                                    isManagerOrAdmin={ws.isManagerOrAdmin}
                                />
                            )}

                            {ws.lens === 'capacity' && (
                                <div className="max-w-4xl mx-auto">
                                    <EmployeeSidebar
                                        employees={ws.employees}
                                        projects={ws.filteredProjects}
                                        allProjects={ws.allProjects}
                                        timeframe={ws.timeframe}
                                        currentDate={ws.currentDate}
                                        currentUserRole={ws.currentUserRole}
                                        currentUserEmployeeId={ws.currentUserEmployeeId}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Desktop Inspector Sidebar */}
                        {!isMobile && inspectorFocus && (
                            <div className="hidden lg:block sticky top-[30px]" style={{ height: 'calc(100vh - 60px)' }}>
                                <InspectorHost
                                    focusId={inspectorFocus}
                                    onClose={() => setInspectorFocus(null)}
                                    projects={ws.allProjects}
                                    employees={ws.employees}
                                    isManagerOrAdmin={ws.isManagerOrAdmin}
                                    currentUserEmployeeId={ws.currentUserEmployeeId || undefined}
                                    onRefresh={ws.loadData}
                                />
                            </div>
                        )}
                    </div>

                    {/* ===== Modals & Sheets ===== */}
                    <ContentItemCreateModal
                        isOpen={!!addContentProject}
                        onClose={() => {
                            setAddContentProject(null);
                            setAddContentDefaultDate(undefined);
                        }}
                        project={addContentProject}
                        defaultPublishDate={addContentDefaultDate}
                        employees={ws.employees}
                        onSuccess={ws.fetchContentItems}
                    />

                    {/* Mobile Inspector Bottom Sheet */}
                    {isMobile && inspectorFocus && (
                        <InspectorHost
                            focusId={inspectorFocus}
                            onClose={() => setInspectorFocus(null)}
                            projects={ws.allProjects}
                            employees={ws.employees}
                            isManagerOrAdmin={ws.isManagerOrAdmin}
                            currentUserEmployeeId={ws.currentUserEmployeeId || undefined}
                            onRefresh={ws.loadData}
                        />
                    )}

                    {/* Quick Project Creation */}
                    {isMobile ? (
                        <BottomSheet
                            isOpen={showProjectForm}
                            onClose={() => {
                                setShowProjectForm(false);
                                setEditingProject(undefined);
                            }}
                            title="New Project"
                        >
                            <div className="p-4">
                                <QuickProjectForm
                                    employees={ws.employees}
                                    defaultStatus={defaultStatus}
                                    onSubmit={handleSubmitProject}
                                    onCancel={() => {
                                        setShowProjectForm(false);
                                        setEditingProject(undefined);
                                    }}
                                />
                            </div>
                        </BottomSheet>
                    ) : (
                        <Modal
                            isOpen={showProjectForm}
                            onClose={() => {
                                setShowProjectForm(false);
                                setEditingProject(undefined);
                            }}
                            title="New Project"
                        >
                            <QuickProjectForm
                                employees={ws.employees}
                                defaultStatus={defaultStatus}
                                onSubmit={handleSubmitProject}
                                onCancel={() => {
                                    setShowProjectForm(false);
                                    setEditingProject(undefined);
                                }}
                            />
                        </Modal>
                    )}

                    <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
                    <VoiceOverlay />
                </div>
            </div>
        </VoiceProvider>
    );
}
