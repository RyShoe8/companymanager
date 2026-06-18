'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { IClient } from '@/lib/models/Client';
import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import EditableText from '@/components/ui/EditableText';
import EditableSelect from '@/components/ui/EditableSelect';
import ClientLogo from '@/components/clients/ClientLogo';
import ClientOperationsPanel from '@/components/workspace/ClientOperationsPanel';
import ClientImpactReportModal from '@/components/workspace/ClientImpactReportModal';
import {
  activeClientProjects,
  clientHubProject,
} from '@/lib/clients/clientProjectHelpers';

interface ClientDetailDashboardProps {
    client: IClient;
    projects: IProject[];
    contentItems?: IContentItem[];
    onBack: () => void;
    onViewProject: (project: IProject) => void;
    onAddTask?: (project: IProject) => void;
    onAddContent?: (project: IProject, defaultDate?: Date) => void;
    onUpdateClient?: (clientId: string, updates: Partial<IClient> & Record<string, unknown>) => void | Promise<void>;
    isManagerOrAdmin?: boolean;
    currentUserId?: string;
}

export default function ClientDetailDashboard({
    client,
    projects,
    contentItems = [],
    onBack,
    onViewProject,
    onAddTask,
    onAddContent,
    onUpdateClient,
    isManagerOrAdmin = false,
    currentUserId,
}: ClientDetailDashboardProps) {
    const [showImpactReport, setShowImpactReport] = useState(false);
    const [logo, setLogo] = useState(client.logo);
    const activeProjects = activeClientProjects(projects);
    const adminProject = clientHubProject(projects);

    useEffect(() => {
        setLogo(client.logo ?? adminProject?.logo);
    }, [client.logo, adminProject?.logo, client._id]);

    const hubContentCount = useMemo(() => {
        if (!adminProject?._id) return 0;
        const hubId = String(adminProject._id);
        return contentItems.filter((c) => String(c.projectId) === hubId).length;
    }, [adminProject?._id, contentItems]);

    const handleUpdate = async (clientId: string, updates: Partial<IClient> & Record<string, unknown>) => {
        await onUpdateClient?.(clientId, updates);
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-background-elevated rounded-md text-text-secondary transition-colors"
                    aria-label="Back to Clients"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <ClientLogo
                    clientId={String(client._id)}
                    logo={logo}
                    color={client.color || '#3b82f6'}
                    name={client.name}
                    isManagerOrAdmin={isManagerOrAdmin}
                    onLogoUpdate={setLogo}
                />
                <div>
                    <EditableText
                        value={client.name}
                        onSave={(v) => onUpdateClient?.(String(client._id), { name: v })}
                        className="text-2xl font-semibold text-text-primary block"
                        placeholder="Client Name"
                        disabled={!onUpdateClient}
                    />
                    <div className="mt-1">
                        <EditableText
                            value={client.domain || ''}
                            onSave={(v) => onUpdateClient?.(String(client._id), { domain: v })}
                            className="text-sm text-text-secondary hover:text-primary transition-colors block"
                            placeholder="Add domain (e.g. acme.com)..."
                            disabled={!onUpdateClient}
                        />
                    </div>
                </div>
                <div className="ml-auto">
                    <button
                        type="button"
                        onClick={() => setShowImpactReport(true)}
                        className="px-4 py-2 bg-background-elevated border border-border text-text-primary rounded-md text-sm font-medium hover:bg-background-accent transition-colors"
                    >
                        Generate Impact Report
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-background-elevated rounded-xl border border-border p-5">
                        <h3 className="text-sm font-medium text-text-primary mb-4">Client Details</h3>
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Primary Contact</p>
                                <EditableText
                                    value={client.contactName || ''}
                                    onSave={(v) => onUpdateClient?.(String(client._id), { contactName: v })}
                                    className="text-sm text-text-secondary block"
                                    placeholder="Add contact name..."
                                    disabled={!onUpdateClient}
                                />
                            </div>
                            <div>
                                <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Email</p>
                                <EditableText
                                    value={client.contactEmail || ''}
                                    onSave={(v) => onUpdateClient?.(String(client._id), { contactEmail: v })}
                                    className="text-sm text-primary block"
                                    placeholder="Add email address..."
                                    disabled={!onUpdateClient}
                                />
                            </div>
                            <div>
                                <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Status</p>
                                <EditableSelect
                                    value={client.status || 'active'}
                                    options={[
                                        { value: 'active', label: 'Active', color: 'green' },
                                        { value: 'lead', label: 'Lead', color: 'yellow' },
                                        { value: 'inactive', label: 'Inactive', color: 'gray' }
                                    ]}
                                    onSave={(v) => onUpdateClient?.(String(client._id), { status: v as IClient['status'] })}
                                    disabled={!onUpdateClient}
                                    showColorDot
                                    surface="workspace"
                                    className="text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <ClientOperationsPanel
                        client={client}
                        projects={projects}
                        isManagerOrAdmin={isManagerOrAdmin}
                        currentUserId={currentUserId}
                        onUpdateClient={handleUpdate}
                        onViewProject={onViewProject}
                    />
                    {adminProject && (
                        <div className="bg-background-elevated rounded-xl border border-border p-5">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <h3 className="text-sm font-medium text-text-primary">Client Headquarters</h3>
                                <div className="flex flex-wrap items-center gap-2">
                                    {onAddTask && (
                                        <button
                                            type="button"
                                            onClick={() => onAddTask(adminProject)}
                                            className="px-3 py-1.5 border border-border bg-background text-text-primary hover:bg-background-accent rounded-md text-xs font-medium transition-colors"
                                        >
                                            + Task
                                        </button>
                                    )}
                                    {onAddContent && (
                                        <button
                                            type="button"
                                            onClick={() => onAddContent(adminProject, new Date())}
                                            className="px-3 py-1.5 border border-border bg-background text-text-primary hover:bg-background-accent rounded-md text-xs font-medium transition-colors"
                                        >
                                            + Content
                                        </button>
                                    )}
                                    <button 
                                        type="button"
                                        onClick={() => onViewProject(adminProject)}
                                        className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-xs font-medium transition-colors"
                                    >
                                        Open Headquarters
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm text-text-secondary mb-4">Manage general tasks, content, and meetings for this client.</p>
                            <div className="flex gap-4">
                                <div className="bg-background p-3 rounded-lg border border-border flex-1">
                                    <div className="text-xs text-text-tertiary mb-1 uppercase tracking-wider">Active Tasks</div>
                                    <div className="text-xl font-semibold text-text-primary">
                                        {adminProject.tasks?.filter((t) => t.status !== 'completed').length || 0}
                                    </div>
                                </div>
                                <div className="bg-background p-3 rounded-lg border border-border flex-1">
                                    <div className="text-xs text-text-tertiary mb-1 uppercase tracking-wider">Content Items</div>
                                    <div className="text-xl font-semibold text-text-primary">{hubContentCount}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-background-elevated rounded-xl border border-border p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-text-primary">Active Projects ({activeProjects.length})</h3>
                        </div>
                        {activeProjects.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {activeProjects.map(project => (
                                    <div 
                                        key={project._id?.toString()}
                                        onClick={() => onViewProject(project)}
                                        className="cursor-pointer transition-transform hover:-translate-y-1 bg-background border border-border rounded-lg p-4 flex flex-col gap-2 hover:border-primary/50"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color || '#3b82f6' }} />
                                                <h4 className="font-medium text-text-primary text-sm truncate">{project.name}</h4>
                                            </div>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                                                project.status === 'launched' || project.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                                project.status === 'in-development' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                                'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                            }`}>
                                                {project.status || 'planning'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-text-secondary mt-1">
                                            {project.projectType} • {project.category}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-text-secondary border border-dashed border-border rounded-lg">
                                <p className="text-sm">No active projects for this client.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ClientImpactReportModal
                isOpen={showImpactReport}
                clientId={String(client._id)}
                clientName={client.name}
                onClose={() => setShowImpactReport(false)}
            />
        </div>
    );
}
