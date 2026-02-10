'use client';

import { useState, useEffect } from 'react';
import { IProject, TaskStatus } from '@/lib/models/Project';
import { IOperation } from '@/lib/models/Operation';
import { IEmployee } from '@/lib/models/Employee';
import EditableText from '@/components/ui/EditableText';
import EditableDate from '@/components/ui/EditableDate';
import EditableNumber from '@/components/ui/EditableNumber';
import EditableSelect from '@/components/ui/EditableSelect';
import SwipeableCard from '@/components/ui/SwipeableCard';
import BottomSheet, { QuickAction } from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import CommentThread from '@/components/comments/CommentThread';
import WireframeButton from '@/components/wireframes/WireframeButton';
import WireframeViewer from '@/components/wireframes/WireframeViewer';
import ProjectLogo from '@/components/projects/ProjectLogo';
import { formatDate } from '@/lib/utils/dateUtils';

interface InlineProjectViewProps {
  project: IProject;
  employees: IEmployee[];
  isManagerOrAdmin: boolean;
  currentUserEmployeeId?: string | null;
  onUpdate: (updates: Partial<IProject>) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
  onRefresh: () => void;
}

export default function InlineProjectView({ project, employees, isManagerOrAdmin, currentUserEmployeeId, onUpdate, onDelete, onClose, onRefresh }: InlineProjectViewProps) {
  const [localProject, setLocalProject] = useState(project);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    return new Set(project.status === 'launched' ? ['operations'] : ['tasks']);
  });
  const [expandedTaskComments, setExpandedTaskComments] = useState<Set<number>>(new Set());
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number | null>(null);
  const [showTaskActions, setShowTaskActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showWireframe, setShowWireframe] = useState(false);
  const [projectOperations, setProjectOperations] = useState<IOperation[]>([]);
  
  const toggleTaskComments = (taskIdx: number) => {
    setExpandedTaskComments(prev => {
      const newSet = new Set(prev);
      newSet.has(taskIdx) ? newSet.delete(taskIdx) : newSet.add(taskIdx);
      return newSet;
    });
  };

  useEffect(() => { 
    setLocalProject(project);
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
    setIsSaving(true);
    setLocalProject(prev => ({ ...prev, [field]: value } as IProject));
    try { 
      const updates = { [field]: value };
      console.log('Sending update:', { field, value, updates: JSON.stringify(updates) });
      await onUpdate(updates); 
    } catch (error) {
      console.error('Error in handleFieldUpdate:', error);
      setLocalProject(project); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleTaskUpdate = async (taskIndex: number, field: string, value: any) => {
    const updatedTasks = [...(localProject.tasks || [])];
    // Preserve all existing task fields when updating
    updatedTasks[taskIndex] = { 
      ...updatedTasks[taskIndex], 
      [field]: value 
    };
    
    // Debug: Log the update to verify status is included
    if (field === 'status') {
      console.log('Updating task status:', { taskIndex, oldStatus: localProject.tasks?.[taskIndex]?.status, newStatus: value, task: updatedTasks[taskIndex] });
    }
    
    setIsSaving(true);
    setLocalProject(prev => ({ ...prev, tasks: updatedTasks } as IProject));
    try { 
      await onUpdate({ tasks: updatedTasks }); 
    } catch (error) { 
      console.error('Error updating task:', error);
      setLocalProject(project); 
    } finally { 
      setIsSaving(false); 
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
    setIsSaving(true);
    try {
      const res = await fetch(`/api/operations/${operationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update operation');
      const updatedOp = await res.json();
      setProjectOperations(prev => prev.map(op => op._id.toString() === operationId ? updatedOp : op));
    } catch (error) {
      console.error('Error updating operation:', error);
      onRefresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-h-[85vh] overflow-y-auto">
      {isSaving && <div className="fixed top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm animate-pulse z-50">Saving...</div>}

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
          <WireframeButton
            projectId={localProject._id.toString()}
            isManagerOrAdmin={isManagerOrAdmin}
            onOpen={() => setShowWireframe(true)}
          />
        </div>
      </div>

      {/* Tasks or Operations Section */}
      {localProject.status === 'launched' ? (
        /* Operations Section for Launched Projects */
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="w-full flex items-center justify-between p-4">
            <div onClick={() => toggleSection('operations')} className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 cursor-pointer flex-1">
              <span className="text-gray-500 text-sm">{expandedSections.has('operations') ? '▼' : '▶'}</span>
              Operations ({projectOperations.length})
            </div>
          </div>
          {expandedSections.has('operations') && (
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
          )}
        </div>
      ) : (
        /* Tasks Section for Non-Launched Projects */
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="w-full flex items-center justify-between p-4">
            <div onClick={() => toggleSection('tasks')} className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 cursor-pointer flex-1">
              <span className="text-gray-500 text-sm">{expandedSections.has('tasks') ? '▼' : '▶'}</span>
              Tasks ({localProject.tasks?.length || 0})
            </div>
            {isManagerOrAdmin && <Button size="sm" onClick={handleAddTask}>+ Add Task</Button>}
          </div>
          {expandedSections.has('tasks') && (
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
                        {/* Task Comments Toggle */}
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => toggleTaskComments(idx)} 
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <span className="text-xs">{expandedTaskComments.has(idx) ? '▼' : '▶'}</span>
                            Comments
                          </button>
                          {expandedTaskComments.has(idx) && (
                            <div className="mt-2">
                              <CommentThread entityType="projectTask" entityId={project._id.toString()} taskIndex={idx} showHeading={false} />
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
      )}

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

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">Close</Button>
        {isManagerOrAdmin && onDelete && <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>Delete</Button>}
      </div>

      {/* Wireframe Viewer */}
      {showWireframe && (
        <WireframeViewer
          projectId={localProject._id.toString()}
          isManagerOrAdmin={isManagerOrAdmin}
          onClose={() => setShowWireframe(false)}
        />
      )}

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
