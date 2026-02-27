'use client';

import { useState, useEffect, useRef } from 'react';
import { IOperation } from '@/lib/models/Operation';
import { IEmployee } from '@/lib/models/Employee';
import { IProject } from '@/lib/models/Project';
import EditableText from '@/components/ui/EditableText';
import EditableDate from '@/components/ui/EditableDate';
import EditableNumber from '@/components/ui/EditableNumber';
import EditableSelect from '@/components/ui/EditableSelect';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import CommentThread from '@/components/comments/CommentThread';

interface InlineOperationViewProps { operation: IOperation; employees: IEmployee[]; projects: IProject[]; isManagerOrAdmin: boolean; currentUserEmployeeId?: string | null; onUpdate: (updates: Partial<IOperation>) => Promise<void>; onDelete?: () => void; onClose: () => void; onRefresh: () => void; }

export default function InlineOperationView({ operation, employees, projects, isManagerOrAdmin, currentUserEmployeeId, onUpdate, onDelete, onClose, onRefresh }: InlineOperationViewProps) {
  const [localOp, setLocalOp] = useState(operation);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['details']));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setLocalOp(operation); }, [operation]);
  useEffect(() => () => { if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current); }, []);

  const clearSaveStatusAfterDelay = (status: 'saved' | 'failed' = 'saved') => {
    if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), status === 'failed' ? 2500 : 1200);
  };

  const toggleSection = (section: string) => { setExpandedSections(prev => { const newSet = new Set(prev); newSet.has(section) ? newSet.delete(section) : newSet.add(section); return newSet; }); };

  const handleFieldUpdate = async (field: string, value: any) => {
    setSaveStatus('saving');
    setLocalOp(prev => ({ ...prev, [field]: value } as IOperation));
    try { 
      await onUpdate({ [field]: value }); 
      setSaveStatus('saved');
      clearSaveStatusAfterDelay();
    } catch (error) {
      console.error('Error updating operation:', error);
      setLocalOp(operation); 
      setSaveStatus('failed');
      clearSaveStatusAfterDelay('failed');
      alert(error instanceof Error ? error.message : 'Failed to save');
    }
  };

  const handleSubmitForReview = async () => { await handleFieldUpdate('status', 'in-review'); };
  const handleComplete = async () => { await handleFieldUpdate('status', 'completed'); };
  const handleDeclineReview = async () => { await handleFieldUpdate('status', 'active'); };

  const statusOptions = [{ value: 'active', label: 'Active', color: '#3b82f6' }, { value: 'in-review', label: 'In Review', color: '#f59e0b' }, { value: 'completed', label: 'Completed', color: '#22c55e' }];
  const recurrenceOptions = [{ value: 'none', label: 'One-time' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'yearly', label: 'Yearly' }];
  const employeeOptions = employees.map(emp => ({ value: emp._id.toString(), label: emp.name }));
  const projectOptions = [{ value: '', label: 'No Project' }, ...projects.map(p => ({ value: p._id.toString(), label: p.name }))];

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

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <EditableText value={localOp.name} onSave={(v) => handleFieldUpdate('name', v)} className="text-xl font-bold text-gray-900 dark:text-white block w-full" placeholder="Operation name" disabled={!isManagerOrAdmin} />
            <EditableText value={localOp.description || ''} onSave={(v) => handleFieldUpdate('description', v)} className="text-gray-600 dark:text-gray-400 mt-1 block w-full" placeholder="Add description..." multiline disabled={!isManagerOrAdmin} />
          </div>
          <EditableSelect value={localOp.status} options={statusOptions} onSave={(v) => handleFieldUpdate('status', v)} showColorDot />
        </div>
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          {localOp.status === 'active' && <Button size="sm" variant="secondary" onClick={handleSubmitForReview}>Submit for Review</Button>}
          {localOp.status === 'in-review' && isManagerOrAdmin && <><Button size="sm" onClick={handleComplete}>Approve & Complete</Button><Button size="sm" variant="danger" onClick={handleDeclineReview}>Decline</Button></>}
          {localOp.status !== 'completed' && <Button size="sm" variant="secondary" onClick={handleComplete}>Mark Complete</Button>}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <button onClick={() => toggleSection('details')} className="w-full flex items-center justify-between p-4 text-left">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className={`w-4 h-4 transition-transform ${expandedSections.has('details') ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            Details
          </h3>
        </button>
        {expandedSections.has('details') && (
          <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs text-gray-500 mb-1">Start Date</label><EditableDate value={localOp.startDate ?? null} onSave={(v) => handleFieldUpdate('startDate', v)} placeholder="Set start date" disabled={!isManagerOrAdmin} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">End Date</label><EditableDate value={localOp.endDate ?? null} onSave={(v) => handleFieldUpdate('endDate', v)} placeholder="Set end date" disabled={!isManagerOrAdmin} /></div>
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">Recurrence</label><EditableSelect value={localOp.recurrenceType || 'none'} options={recurrenceOptions} onSave={(v) => handleFieldUpdate('recurrenceType', v)} disabled={!isManagerOrAdmin} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Estimated Hours</label><EditableNumber value={localOp.estimatedHours} onSave={(v) => handleFieldUpdate('estimatedHours', v)} suffix="h" min={0} disabled={!isManagerOrAdmin} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Linked Project</label><EditableSelect value={localOp.projectId?.toString() || ''} options={projectOptions} onSave={(v) => handleFieldUpdate('projectId', v || undefined)} disabled={!isManagerOrAdmin} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Assigned To</label><EditableSelect value={(localOp as any).assignedToEmployeeId?.toString() || ''} options={[{ value: '', label: 'Unassigned' }, ...employeeOptions]} onSave={(v) => handleFieldUpdate('assignedToEmployeeId', v || undefined)} disabled={!isManagerOrAdmin} /></div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <button onClick={() => toggleSection('comments')} className="w-full flex items-center justify-between p-4 text-left">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className={`w-4 h-4 transition-transform ${expandedSections.has('comments') ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            Comments
          </h3>
        </button>
        {expandedSections.has('comments') && <div className="border-t border-gray-100 dark:border-gray-700 p-4"><CommentThread entityType="operation" entityId={operation._id.toString()} /></div>}
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">Close</Button>
        {isManagerOrAdmin && onDelete && <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>Delete</Button>}
      </div>

      <BottomSheet isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Operation?">
        <div className="p-4">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Are you sure you want to delete "{localOp.name}"?</p>
          <div className="flex gap-2"><Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} className="flex-1">Cancel</Button><Button variant="danger" onClick={() => { onDelete?.(); setShowDeleteConfirm(false); }} className="flex-1">Delete</Button></div>
        </div>
      </BottomSheet>
    </div>
  );
}
