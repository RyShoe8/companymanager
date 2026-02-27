'use client';

import { useState, useEffect, useRef } from 'react';
import { IProject, TaskStatus } from '@/lib/models/Project';
import { IOperation } from '@/lib/models/Operation';
import { IEmployee } from '@/lib/models/Employee';
import { IContentItem } from '@/lib/models/ContentItem';
import EditableText from '@/components/ui/EditableText';
import EditableDate from '@/components/ui/EditableDate';
import EditableNumber from '@/components/ui/EditableNumber';
import EditableSelect from '@/components/ui/EditableSelect';
import SwipeableCard from '@/components/ui/SwipeableCard';
import BottomSheet, { QuickAction } from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import CommentThread from '@/components/comments/CommentThread';
import ProjectLogo from '@/components/projects/ProjectLogo';
import { formatDate } from '@/lib/utils/dateUtils';
import { mapStatusToStage } from '@/lib/utils/statusMapping';
import ChecklistSection from '@/components/checklist/ChecklistSection';
import AddButton from '@/components/checklist/AddButton';

interface InlineProjectViewProps {
  project: IProject;
  employees: IEmployee[];
  isManagerOrAdmin: boolean;
  currentUserEmployeeId?: string | null;
  onUpdate: (updates: Partial<IProject>) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
  onRefresh: () => void;
  /** Called when user clicks "+ Add Operation" for this project (launched only). */
  onAddOperation?: (projectId: string) => void;
  /** Called when user clicks "Add Content"; parent should open ContentItemCreateModal and refresh on success. */
  onAddContent?: (project: IProject) => void;
  /** Called when user clicks a content item; parent should open ContentItemDetailModal. */
  onContentItemClick?: (item: IContentItem) => void;
  /** When this changes, project content list is refetched (e.g. after detail modal save/delete). */
  contentRefreshTrigger?: number;
}

function canAddContentToProject(project: IProject, isManagerOrAdmin: boolean, currentUserEmployeeId: string | null | undefined): boolean {
  if (isManagerOrAdmin) return true;
  if (!currentUserEmployeeId) return false;
  const pid = (project as any).assignedToEmployeeId?.toString();
  if (pid === currentUserEmployeeId) return true;
  const ids = (project as any).assignedToEmployeeIds;
  if (ids?.some((id: any) => id?.toString() === currentUserEmployeeId)) return true;
  if (project.tasks?.some((t) => (t as any).assignedToEmployeeId?.toString() === currentUserEmployeeId)) return true;
  return false;
}

export default function InlineProjectView({ project, employees, isManagerOrAdmin, currentUserEmployeeId, onUpdate, onDelete, onClose, onRefresh, onAddOperation, onAddContent, onContentItemClick, contentRefreshTrigger }: InlineProjectViewProps) {
  const [localProject, setLocalProject] = useState(project);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    return new Set(project.status === 'launched' ? ['operations'] : ['tasks']);
  });
  const [expandedTaskComments, setExpandedTaskComments] = useState<Set<number>>(new Set());
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number | null>(null);
  const [showTaskActions, setShowTaskActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [projectOperations, setProjectOperations] = useState<IOperation[]>([]);
  const [actionButtons, setActionButtons] = useState<{ label: string; url: string }[]>([]);
  /** When set, overrides localProject.dismissedChecklistIds for ChecklistSection (avoids mutating IProject Document). */
  const [localDismissedChecklistIds, setLocalDismissedChecklistIds] = useState<string[] | null>(null);
  /** Tab for tasks/operations vs content. */
  const [viewTab, setViewTab] = useState<'tasks' | 'operations' | 'content'>(project.status === 'launched' ? 'operations' : 'tasks');
  const [projectContentItems, setProjectContentItems] = useState<IContentItem[]>([]);

  // Clear saved status after brief display; cleanup on unmount
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const clearSaveStatusAfterDelay = (status: 'saved' | 'failed' = 'saved') => {
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), status === 'failed' ? 2500 : 1200);
  };

  const toggleTaskComments = (taskIdx: number) => {
    setExpandedTaskComments(prev => {
      const newSet = new Set(prev);
      newSet.has(taskIdx) ? newSet.delete(taskIdx) : newSet.add(taskIdx);
      return newSet;
    });
  };

  useEffect(() => { 
    setLocalProject(project);
    setLocalDismissedChecklistIds(null); // use project data when project changes
    setViewTab(project.status === 'launched' ? 'operations' : 'tasks');
    // Update expanded sections based on project status
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (project.status === 'launched') {
        newSet.delete('tasks');
        newSet.add('operations');
      } else {
        newSet.delete('operations');
        newSet.add('tasks');
      }
      return newSet;
    });
  }, [project]);

  // Fetch project action buttons (smart buttons)
  useEffect(() => {
    const fetchButtons = async () => {
      try {
        const res = await fetch(`/api/projects/${localProject._id}/buttons`);
        if (res.ok) {
          const data = await res.json();
          setActionButtons(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        // ignore
      }
    };
    fetchButtons();
  }, [localProject._id]);

  useEffect(() => {
    const fetchProjectContent = async () => {
      try {
        const res = await fetch(`/api/content-items?projectId=${localProject._id}`);
        if (res.ok) {
          const data = await res.json();
          setProjectContentItems(Array.isArray(data) ? data : []);
        }
      } catch {
        setProjectContentItems([]);
      }
    };
    fetchProjectContent();
  }, [localProject._id, contentRefreshTrigger]);

  const handleDeleteContentItem = async (item: IContentItem) => {
    if (!confirm('Delete this content item? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/content-items/${item._id}`, { method: 'DELETE' });
      if (res.ok) {
        setProjectContentItems((prev) => prev.filter((c) => c._id.toString() !== item._id.toString()));
        onRefresh();
      }
    } catch {
      // ignore
    }
  };

  // Fetch operations for launched projects
  useEffect(() => {
    const fetchOperations = async () => {
      if (localProject.status === 'launched') {
        try {
          const operationsRes = await fetch('/api/operations');
          if (operationsRes.ok) {
            const operationsData = await operationsRes.json();
            const linkedOperations = operationsData.filter((o: IOperation) => 
              o.projectId?.toString() === localProject._id.toString()
            );
            setProjectOperations(linkedOperations);
          }
        } catch (error) {
          console.error('Error fetching operations:', error);
        }
      } else {
        setProjectOperations([]);
      }
    };
    fetchOperations();
  }, [localProject.status, localProject._id]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => { const newSet = new Set(prev); newSet.has(section) ? newSet.delete(section) : newSet.add(section); return newSet; });
  };

  const handleFieldUpdate = async (field: string, value: any) => {
    setSaveStatus('saving');
    setLocalProject(prev => ({ ...prev, [field]: value } as IProject));
    try { 
      const updates = { [field]: value };
      await onUpdate(updates); 
      setSaveStatus('saved');
      clearSaveStatusAfterDelay();
    } catch (error) {
      console.error('Error in handleFieldUpdate:', error);
      setLocalProject(project); 
      setSaveStatus('failed');
      clearSaveStatusAfterDelay('failed');
      alert(error instanceof Error ? error.message : 'Failed to save');
    }
  };

  const handleTaskUpdate = async (taskIndex: number, field: string, value: any) => {
    const updatedTasks = [...(localProject.tasks || [])];
    updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], [field]: value };
    setSaveStatus('saving');
    setLocalProject(prev => ({ ...prev, tasks: updatedTasks } as IProject));
    try { 
      await onUpdate({ tasks: updatedTasks }); 
      setSaveStatus('saved');
      clearSaveStatusAfterDelay();
    } catch (error) { 
      console.error('Error updating task:', error);
      setLocalProject(project); 
      setSaveStatus('failed');
      clearSaveStatusAfterDelay('failed');
      alert(error instanceof Error ? error.message : 'Failed to save');
    }
  };

  const handleSubmitForReview = async (taskIndex: number) => { await handleTaskUpdate(taskIndex, 'status', 'in-review'); setShowTaskActions(false); };
  const handleCompleteTask = async (taskIndex: number) => { await handleTaskUpdate(taskIndex, 'status', 'completed'); setShowTaskActions(false); };
  const handleDeclineReview = async (taskIndex: number) => { await handleTaskUpdate(taskIndex, 'status', 'active'); setShowTaskActions(false); };
  const handleDeleteTask = async (taskIndex: number) => { await onUpdate({ tasks: (localProject.tasks || []).filter((_, idx) => idx !== taskIndex) }); setShowTaskActions(false); setSelectedTaskIndex(null); };
  const handleAddTask = async () => {
    const newTask = { name: 'New Task', description: '', status: 'active' as TaskStatus, startDate: new Date(), endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), estimatedHours: 0, assignedTo: '' };
    await onUpdate({ tasks: [...(localProject.tasks || []), newTask] });
  };

  const statusOptions = [{ value: 'planning', label: 'Planning', color: '#3b82f6' }, { value: 'in-development', label: 'Building', color: '#22c55e' }, { value: 'launched', label: 'Running', color: '#a855f7' }];
  const projectTypeOptions = [{ value: 'website', label: 'Website' }, { value: 'store', label: 'Store' }, { value: 'app', label: 'App' }, { value: 'generic', label: 'Generic' }];
  const taskStatusOptions = [{ value: 'active', label: 'Active', color: '#3b82f6' }, { value: 'in-review', label: 'In Review', color: '#f59e0b' }, { value: 'completed', label: 'Completed', color: '#22c55e' }];
  const operationStatusOptions = [{ value: 'active', label: 'Active', color: '#3b82f6' }, { value: 'in-review', label: 'In Review', color: '#f59e0b' }, { value: 'completed', label: 'Completed', color: '#22c55e' }];
  const employeeOptions = employees.map(emp => ({ value: emp._id.toString(), label: emp.name }));

  const handleOperationUpdate = async (operationId: string, updates: Partial<IOperation>) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/operations/${operationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update operation');
      const updatedOp = await res.json();
      setProjectOperations(prev => prev.map(op => op._id.toString() === operationId ? updatedOp : op));
      setSaveStatus('saved');
      clearSaveStatusAfterDelay();
    } catch (error) {
      console.error('Error updating operation:', error);
      onRefresh();
      setSaveStatus('failed');
      clearSaveStatusAfterDelay('failed');
      alert(error instanceof Error ? error.message : 'Failed to save');
    }
  };

  return (
    <div className="space-y-4 max-h-[85vh] overflow-y-auto">
      {saveStatus !== 'idle' && (
        <div className={`fixed top-4 right-4 px-3 py-1.5 rounded-lg text-sm font-medium z-50 shadow-lg ${
          saveStatus === 'saving' ? 'bg-blue-500 text-white animate-pulse' :
          saveStatus === 'failed' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'failed' ? 'Save failed' : 'Saved'}
        </div>
      )}

      {/* Project Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <ProjectLogo
            projectId={localProject._id.toString()}
            logo={localProject.logo}
            color={localProject.color || '#3b82f6'}
            isManagerOrAdmin={isManagerOrAdmin}
            onLogoUpdate={(logoUrl) => handleFieldUpdate('logo', logoUrl)}
          />
          <div className="flex-1 min-w-0">
            <EditableText value={localProject.name} onSave={(v) => handleFieldUpdate('name', v)} className="text-xl font-bold text-gray-900 dark:text-white block w-full" placeholder="Project name" disabled={!isManagerOrAdmin} />
            <EditableText value={localProject.description || ''} onSave={(v) => handleFieldUpdate('description', v)} className="text-gray-600 dark:text-gray-400 mt-1 block w-full" placeholder="Add description..." multiline disabled={!isManagerOrAdmin} />
          </div>
          <EditableSelect value={localProject.status} options={statusOptions} onSave={(v) => handleFieldUpdate('status', v)} showColorDot disabled={!isManagerOrAdmin} />
        </div>
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm"><span className="text-gray-500">Type:</span><EditableSelect value={localProject.projectType || 'generic'} options={projectTypeOptions} onSave={(v) => handleFieldUpdate('projectType', v)} disabled={!isManagerOrAdmin} /></div>
          <div className="flex items-center gap-2 text-sm"><span className="text-gray-500">Est. Hours:</span><EditableNumber value={localProject.estimatedHours} onSave={(v) => handleFieldUpdate('estimatedHours', v)} suffix="h" min={0} disabled={!isManagerOrAdmin} /></div>
          <div className="flex items-center gap-2 text-sm"><span className="text-gray-500">End Date:</span><EditableDate value={localProject.endDate ?? null} onSave={(v) => handleFieldUpdate('endDate', v || undefined)} placeholder="No end date" disabled={!isManagerOrAdmin} /></div>
          {localProject.status === 'launched' ? (
            <div className="flex items-center gap-2 text-sm"><span className="text-gray-500">Operations:</span><span className="font-medium">{projectOperations.length}</span></div>
          ) : (
            <div className="flex items-center gap-2 text-sm"><span className="text-gray-500">Tasks:</span><span className="font-medium">{localProject.tasks?.length || 0}</span></div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <AddButton
            projectId={localProject._id.toString()}
            phase={mapStatusToStage(localProject.status)}
            projectType={localProject.projectType || 'generic'}
            isManagerOrAdmin={isManagerOrAdmin}
            onAddButton={async (label, url) => {
              const res = await fetch(`/api/projects/${localProject._id}/buttons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label, url }),
              });
              if (res.ok) {
                const data = await res.json();
                setActionButtons(Array.isArray(data) ? data : []);
              }
            }}
          />
        </div>
      </div>

      {/* Checklist (replaces Smart buttons) */}
      <ChecklistSection
        projectId={localProject._id.toString()}
        phase={mapStatusToStage(localProject.status)}
        projectType={localProject.projectType || 'generic'}
        actionButtons={actionButtons}
        dismissedChecklistIds={localDismissedChecklistIds ?? (localProject.dismissedChecklistIds || []).map((id) => id.toString())}
        isManagerOrAdmin={isManagerOrAdmin}
        onUpdate={async (updates) => {
          await onUpdate(updates as Partial<IProject>);
          if (updates.dismissedChecklistIds !== undefined) {
            setLocalDismissedChecklistIds(updates.dismissedChecklistIds);
          }
        }}
        onRefreshButtons={async () => {
          const res = await fetch(`/api/projects/${localProject._id}/buttons`);
          if (res.ok) {
            const data = await res.json();
            setActionButtons(Array.isArray(data) ? data : []);
          }
        }}
      />

      {/* Tasks / Operations / Content – tabbed */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1 p-2 border-b border-gray-100 dark:border-gray-700">
          {localProject.status === 'launched' ? (
            <>
              <button type="button" onClick={() => setViewTab('operations')} className={`px-3 py-2 rounded text-sm font-medium ${viewTab === 'operations' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Operations ({projectOperations.length})</button>
              <button type="button" onClick={() => setViewTab('content')} className={`px-3 py-2 rounded text-sm font-medium ${viewTab === 'content' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Content ({projectContentItems.length})</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setViewTab('tasks')} className={`px-3 py-2 rounded text-sm font-medium ${viewTab === 'tasks' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Tasks ({localProject.tasks?.length || 0})</button>
              <button type="button" onClick={() => setViewTab('content')} className={`px-3 py-2 rounded text-sm font-medium ${viewTab === 'content' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Content ({projectContentItems.length})</button>
            </>
          )}
          {viewTab !== 'content' && (localProject.status === 'launched' ? (isManagerOrAdmin && onAddOperation && (
            <button type="button" onClick={() => onAddOperation(localProject._id.toString())} className="ml-auto text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">+ Add Operation</button>
          )) : (
            <div className="ml-auto flex gap-2">
              {isManagerOrAdmin && <Button size="sm" onClick={handleAddTask}>+ Add Task</Button>}
              {onAddContent && canAddContentToProject(localProject, isManagerOrAdmin, currentUserEmployeeId ?? null) && <Button size="sm" variant="secondary" onClick={() => onAddContent(localProject)}>+ Add Content</Button>}
            </div>
          ))}
          {viewTab === 'content' && onAddContent && canAddContentToProject(localProject, isManagerOrAdmin, currentUserEmployeeId ?? null) && (
            <Button size="sm" variant="secondary" onClick={() => onAddContent(localProject)} className="ml-auto">+ Add Content</Button>
          )}
        </div>

        {viewTab === 'content' ? (
          <div className="p-4">
            {projectContentItems.length === 0 ? (
              <div className="text-center text-gray-500 py-6">No content yet. Add content from the calendar or here.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700 space-y-0">
                {projectContentItems.map((item) => (
                  <div key={item._id.toString()} className="flex items-center justify-between gap-2 py-3 first:pt-0">
                    <button type="button" onClick={() => onContentItemClick?.(item)} className="flex-1 min-w-0 text-left">
                      <span className="font-medium text-gray-900 dark:text-white block truncate">{item.title}</span>
                      <span className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">{item.channel}</span>
                        {item.publishDate && <span>{formatDate(new Date(item.publishDate))}</span>}
                        {item.status === 'published' && <span className="opacity-70">Published</span>}
                      </span>
                    </button>
                    <button type="button" onClick={() => handleDeleteContentItem(item)} className="text-red-600 hover:text-red-700 dark:text-red-400 text-sm px-2 py-1 shrink-0">Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : localProject.status === 'launched' ? (
          <div className="border-t border-gray-100 dark:border-gray-700">
            {projectOperations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No operations yet.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {projectOperations.map((operation) => (
                  <div key={operation._id.toString()} className="p-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <EditableText value={operation.name} onSave={(v) => handleOperationUpdate(operation._id.toString(), { name: v })} className="font-medium text-gray-900 dark:text-white" placeholder="Operation name" disabled={!isManagerOrAdmin} />
                        {(operation.description || isManagerOrAdmin) && (
                          <EditableText value={operation.description || ''} onSave={(v) => handleOperationUpdate(operation._id.toString(), { description: v })} className="text-sm text-gray-500 mt-1" placeholder="Add description..." multiline disabled={!isManagerOrAdmin} />
                        )}
                      </div>
                      <div>
                        <EditableSelect value={operation.status || 'active'} options={operationStatusOptions} onSave={(v) => handleOperationUpdate(operation._id.toString(), { status: v as IOperation['status'] })} showColorDot className="text-xs" disabled={!isManagerOrAdmin} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500 items-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <EditableDate value={operation.startDate ? new Date(operation.startDate) : null} onSave={(v) => handleOperationUpdate(operation._id.toString(), { startDate: v })} placeholder="Start" disabled={!isManagerOrAdmin} />
                        <span>→</span>
                        <EditableDate value={operation.endDate ? new Date(operation.endDate) : null} onSave={(v) => handleOperationUpdate(operation._id.toString(), { endDate: v })} placeholder="End" disabled={!isManagerOrAdmin} />
                      </div>
                      <EditableNumber value={operation.estimatedHours} onSave={(v) => handleOperationUpdate(operation._id.toString(), { estimatedHours: v })} suffix="h" min={0} placeholder="Hours" disabled={!isManagerOrAdmin} />
                      {employees.length > 0 && (
                        <EditableSelect value={operation.assignedToEmployeeId?.toString() || ''} options={[{ value: '', label: 'Unassigned' }, ...employeeOptions]} onSave={(v) => handleOperationUpdate(operation._id.toString(), { assignedToEmployeeId: (v === '' || !v) ? null : v } as unknown as Partial<IOperation>)} disabled={!isManagerOrAdmin} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Tasks panel */
          <div className="border-t border-gray-100 dark:border-gray-700">
            {!localProject.tasks?.length ? <div className="p-4 text-center text-gray-500">No tasks yet.</div> : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {localProject.tasks.map((task, idx) => (
                  <SwipeableCard key={idx} rightActions={isManagerOrAdmin ? [{ label: 'Delete', color: '#ef4444', onClick: () => handleDeleteTask(idx) }] : []} leftActions={[{ label: task.status === 'in-review' ? 'Approve' : 'Complete', color: '#22c55e', onClick: () => handleCompleteTask(idx) }]}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                          <EditableText value={task.name} onSave={(v) => handleTaskUpdate(idx, 'name', v)} className="font-medium text-gray-900 dark:text-white" placeholder="Task name" disabled={!isManagerOrAdmin} />
                          {(task.description || isManagerOrAdmin) && <EditableText value={task.description || ''} onSave={(v) => handleTaskUpdate(idx, 'description', v)} className="text-sm text-gray-500 mt-1" placeholder="Add description..." disabled={!isManagerOrAdmin} />}
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <EditableSelect value={task.status || 'active'} options={taskStatusOptions} onSave={(v) => handleTaskUpdate(idx, 'status', v)} showColorDot className="text-xs" />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <EditableDate value={task.startDate} onSave={(v) => handleTaskUpdate(idx, 'startDate', v)} placeholder="Start" disabled={!isManagerOrAdmin} />
                          <span>→</span>
                          <EditableDate value={task.endDate} onSave={(v) => handleTaskUpdate(idx, 'endDate', v)} placeholder="End" disabled={!isManagerOrAdmin} />
                        </div>
                        <EditableNumber value={task.estimatedHours} onSave={(v) => handleTaskUpdate(idx, 'estimatedHours', v)} suffix="h" min={0} placeholder="Hours" disabled={!isManagerOrAdmin} />
                        {employees.length > 0 && <EditableSelect value={(task as any).assignedToEmployeeId?.toString() || ''} options={[{ value: '', label: 'Unassigned' }, ...employeeOptions]} onSave={(v) => handleTaskUpdate(idx, 'assignedToEmployeeId', v || undefined)} disabled={!isManagerOrAdmin} />}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleTaskComments(idx)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                          <span className="text-xs">{expandedTaskComments.has(idx) ? '▼' : '▶'}</span> Comments
                        </button>
                        {expandedTaskComments.has(idx) && (
                          <div className="mt-2">
                            <CommentThread entityType="projectTask" entityId={project._id.toString()} taskIndex={idx} taskId={(project.tasks?.[idx] as { _id?: { toString: () => string } })?._id?.toString()} showHeading={false} />
                          </div>
                        )}
                      </div>
                    </div>
                  </SwipeableCard>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comments Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div onClick={() => toggleSection('comments')} className="w-full flex items-center justify-between p-4 cursor-pointer">
          <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-gray-500 text-sm">{expandedSections.has('comments') ? '▼' : '▶'}</span>
            Comments
          </div>
        </div>
        {expandedSections.has('comments') && <div className="border-t border-gray-100 dark:border-gray-700 p-4"><CommentThread entityType="project" entityId={project._id.toString()} /></div>}
      </div>

      {/* Action Buttons - one Close at bottom, same size as Delete */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="text-sm px-3 py-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Close
        </button>
        {isManagerOrAdmin && onDelete && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm px-3 py-1.5 rounded text-error hover:bg-error-light transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {/* Task Actions Bottom Sheet */}
      <BottomSheet isOpen={showTaskActions && selectedTaskIndex !== null} onClose={() => { setShowTaskActions(false); setSelectedTaskIndex(null); }} title={selectedTaskIndex !== null ? localProject.tasks?.[selectedTaskIndex]?.name : 'Task Actions'}>
        <div className="py-2">
          {selectedTaskIndex !== null && localProject.tasks?.[selectedTaskIndex] && (<>
            {localProject.tasks[selectedTaskIndex].status === 'active' && <QuickAction icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} label="Submit for Review" onClick={() => handleSubmitForReview(selectedTaskIndex)} variant="warning" />}
            {localProject.tasks[selectedTaskIndex].status === 'in-review' && isManagerOrAdmin && (<><QuickAction icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>} label="Approve & Complete" onClick={() => handleCompleteTask(selectedTaskIndex)} variant="success" /><QuickAction icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>} label="Decline Review" onClick={() => handleDeclineReview(selectedTaskIndex)} variant="danger" /></>)}
            {localProject.tasks[selectedTaskIndex].status !== 'completed' && <QuickAction icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>} label="Mark Complete" onClick={() => handleCompleteTask(selectedTaskIndex)} variant="success" />}
            {isManagerOrAdmin && <QuickAction icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>} label="Delete Task" onClick={() => handleDeleteTask(selectedTaskIndex)} variant="danger" />}
          </>)}
        </div>
      </BottomSheet>

      {/* Delete Confirmation Bottom Sheet */}
      <BottomSheet isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Project?">
        <div className="p-4">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Are you sure you want to delete &quot;{localProject.name}&quot;? This action cannot be undone.</p>
          <div className="flex gap-2"><Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} className="flex-1">Cancel</Button><Button variant="danger" onClick={() => { onDelete?.(); setShowDeleteConfirm(false); }} className="flex-1">Delete</Button></div>
        </div>
      </BottomSheet>
    </div>
  );
}
