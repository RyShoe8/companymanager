'use client';

import { useState } from 'react';
import { IEmployee } from '@/lib/models/Employee';
import Button from '@/components/ui/Button';

interface QuickProjectFormProps { employees: IEmployee[]; defaultStatus?: 'planning' | 'in-development' | 'launched'; onSubmit: (data: any) => Promise<void>; onCancel: () => void; }

const colorPalette = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

export default function QuickProjectForm({ employees, defaultStatus = 'planning', onSubmit, onCancel }: QuickProjectFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(colorPalette[Math.floor(Math.random() * colorPalette.length)]);
  const [projectType, setProjectType] = useState<'internal' | 'client'>('client');
  const [category, setCategory] = useState<'website' | 'store' | 'app' | 'generic'>('generic');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [assignedToEmployeeIds, setAssignedToEmployeeIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Project name is required'); return; }
    setIsSubmitting(true); setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        projectType,
        category,
        status: defaultStatus,
        assignedToEmployeeIds: assignedToEmployeeIds.length > 0 ? assignedToEmployeeIds : undefined
      });
    }
    catch { setError('Failed to create project'); } finally { setIsSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-tour="quick-project-form">
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" className="w-full text-lg font-medium px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white" autoFocus />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white resize-none" />
      <div className="flex items-center gap-2"><span className="text-sm text-gray-500">Color:</span><div className="flex gap-1.5">{colorPalette.map((c) => (<button key={c} type="button" onClick={() => setColor(c)} className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''}`} style={{ backgroundColor: c }} />))}</div></div>

      <div className="flex items-center gap-4"><span className="text-sm text-gray-500">Type:</span><div className="flex flex-wrap gap-2">
        {(['internal', 'client'] as const).map((tp) => (
          <button key={tp} type="button" onClick={() => setProjectType(tp)} className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${projectType === tp ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
            {tp.charAt(0).toUpperCase() + tp.slice(1)}
          </button>
        ))}
      </div></div>

      <div className="flex items-center gap-4"><span className="text-sm text-gray-500">Category:</span><div className="flex flex-wrap gap-2">
        {(['website', 'store', 'app', 'generic'] as const).map((cat) => (
          <button key={cat} type="button" onClick={() => setCategory(cat)} className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${category === cat ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div></div>
      <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        {showAdvanced ? 'Hide' : 'Show'} advanced options
      </button>
      {showAdvanced && (<div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign Team Members</label><div className="flex flex-wrap gap-2">{employees.map((emp) => { const isSelected = assignedToEmployeeIds.includes(emp._id.toString()); return (<button key={emp._id.toString()} type="button" onClick={() => { if (isSelected) setAssignedToEmployeeIds(prev => prev.filter(id => id !== emp._id.toString())); else setAssignedToEmployeeIds(prev => [...prev, emp._id.toString()]); }} className={`px-3 py-1.5 text-sm rounded-full transition-colors ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>{emp.name}</button>); })}</div></div>
      </div>)}
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div className="flex gap-2 pt-2"><Button type="button" variant="secondary" onClick={onCancel} className="flex-1">Cancel</Button><Button type="submit" disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Creating...' : 'Create Project'}</Button></div>
    </form>
  );
}
