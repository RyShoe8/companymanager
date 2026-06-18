import React, { useState } from 'react';
import { IClient } from '@/lib/models/Client';
import { IProject } from '@/lib/models/Project';
import ClientDetailDashboard from './ClientDetailDashboard';

interface ClientsViewProps {
    clients: IClient[];
    allProjects: IProject[];
    onViewProject: (project: IProject) => void;
    onCreateClient?: () => void;
    onUpdateClient?: (clientId: string, updates: Partial<IClient>) => void;
}

export default function ClientsView({ clients, allProjects, onViewProject, onCreateClient, onUpdateClient }: ClientsViewProps) {
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

    const selectedClient = clients.find(c => c._id?.toString() === selectedClientId);

    if (selectedClient) {
        const clientProjects = allProjects.filter(p => p.clientId === selectedClient._id);
        return (
            <ClientDetailDashboard 
                client={selectedClient} 
                projects={clientProjects} 
                onBack={() => setSelectedClientId(null)} 
                onViewProject={onViewProject}
                onUpdateClient={onUpdateClient}
            />
        );
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-text-primary">Clients</h2>
                    <p className="text-sm text-text-secondary mt-1">Manage your clients and view their dedicated dashboards.</p>
                </div>
                <button 
                    onClick={onCreateClient}
                    className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover transition-colors shadow-sm"
                >
                    New Client
                </button>
            </div>

            {clients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-background-elevated border border-dashed border-border rounded-xl">
                    <div className="w-16 h-16 bg-background-accent rounded-full flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-text-primary">No clients yet</h3>
                    <p className="text-sm text-text-secondary mt-1 max-w-sm text-center mb-6">
                        Start managing your external relationships by adding your first client.
                    </p>
                    <button 
                        onClick={onCreateClient}
                        className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
                    >
                        Add your first client
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {clients.map(client => {
                        const activeProjectsCount = allProjects.filter(p => p.clientId === client._id && p.status !== 'completed').length;
                        
                        return (
                            <div 
                                key={client._id?.toString()}
                                onClick={() => setSelectedClientId(client._id?.toString() || null)}
                                className="bg-background-elevated border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col h-full relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: client.color || '#3b82f6' }} />
                                
                                <div className="flex items-start justify-between mb-4 mt-1">
                                    <div 
                                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-sm"
                                        style={{ backgroundColor: client.color || '#3b82f6' }}
                                    >
                                        {client.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                        client.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                        client.status === 'lead' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                    }`}>
                                        {client.status}
                                    </span>
                                </div>
                                
                                <h3 className="text-lg font-semibold text-text-primary group-hover:text-primary transition-colors">{client.name}</h3>
                                {client.domain && (
                                    <p className="text-sm text-text-secondary mt-1">{client.domain}</p>
                                )}
                                
                                <div className="mt-auto pt-6 flex items-center justify-between text-sm">
                                    <div className="text-text-tertiary">
                                        <span className="font-medium text-text-primary">{activeProjectsCount}</span> active {activeProjectsCount === 1 ? 'project' : 'projects'}
                                    </div>
                                    <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                        View Dashboard
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M5 12h14M12 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
