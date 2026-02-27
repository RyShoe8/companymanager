'use client';

import { useState, useEffect } from 'react';
import { IAsset, AssetType } from '@/lib/models/Asset';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

interface AssetFormProps {
  asset?: IAsset;
  projects?: Array<{ _id: string; name: string }>;
  operations?: Array<{ _id: string; name: string }>;
  linkedProjectId?: string;
  linkedProjectTaskIndex?: number;
  /** Stable task reference (prefer over linkedProjectTaskIndex). */
  linkedProjectTaskId?: string;
  linkedOperationId?: string;
  onSubmit: (data: Omit<Partial<IAsset>, 'linkedProjectId' | 'linkedOperationId'> & { linkedProjectId?: string; linkedOperationId?: string; linkedProjectTaskIndex?: number; linkedProjectTaskId?: string; file?: File }) => void;
  onCancel: () => void;
}

export default function AssetForm({ asset, projects = [], operations = [], linkedProjectId: initialLinkedProjectId, linkedProjectTaskIndex: initialLinkedProjectTaskIndex, linkedProjectTaskId: initialLinkedProjectTaskId, linkedOperationId: initialLinkedOperationId, onSubmit, onCancel }: AssetFormProps) {
  const [name, setName] = useState(asset?.name || '');
  const [type, setType] = useState<AssetType>(asset?.type || 'link');
  const [url, setUrl] = useState(asset?.url || '');
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState(asset?.textContent || '');
  const [description, setDescription] = useState(asset?.description || '');
  const [category, setCategory] = useState(asset?.category || '');
  const [tags, setTags] = useState(asset?.tags?.join(', ') || '');
  const [linkedProjectId, setLinkedProjectId] = useState(asset?.linkedProjectId?.toString() || initialLinkedProjectId || '');
  const [linkedProjectTaskIndex, setLinkedProjectTaskIndex] = useState(asset?.linkedProjectTaskIndex?.toString() ?? asset?.linkedProjectTaskId ? '' : initialLinkedProjectTaskIndex?.toString() || '');
  const [linkedProjectTaskId, setLinkedProjectTaskId] = useState(asset?.linkedProjectTaskId?.toString() || initialLinkedProjectTaskId || '');
  const [linkedOperationId, setLinkedOperationId] = useState(asset?.linkedOperationId?.toString() || initialLinkedOperationId || '');
  const [selectedProjectTasks, setSelectedProjectTasks] = useState<Array<{ index: number; id?: string; name: string }>>([]);

  // Reset file and textContent when type changes
  useEffect(() => {
    if (type !== 'file') {
      setFile(null);
    }
    if (type !== 'text') {
      setTextContent('');
    }
    if (type === 'text' || type === 'file') {
      setUrl('');
    }
  }, [type]);

  // Fetch project tasks when a project is selected
  useEffect(() => {
    const fetchProjectTasks = async () => {
      if (linkedProjectId) {
        try {
          const response = await fetch(`/api/projects/${linkedProjectId}`);
          if (response.ok) {
            const project = await response.json();
            if (project.tasks && project.tasks.length > 0) {
              setSelectedProjectTasks(
                project.tasks.map((task: any, index: number) => ({
                  index,
                  id: task._id?.toString(),
                  name: task.name,
                }))
              );
            } else {
              setSelectedProjectTasks([]);
            }
          } else {
            setSelectedProjectTasks([]);
          }
        } catch (error) {
          // Error fetching project tasks
          setSelectedProjectTasks([]);
        }
      } else {
        setSelectedProjectTasks([]);
        setLinkedProjectTaskIndex('');
      }
    };
    fetchProjectTasks();
  }, [linkedProjectId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tagArray = tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    
    const submitData: any = {
      name,
      type,
      description: description || undefined,
      category: category || undefined,
      tags: tagArray,
      linkedProjectId: linkedProjectId || undefined,
      linkedProjectTaskId: linkedProjectTaskId || undefined,
      linkedProjectTaskIndex: linkedProjectTaskIndex ? parseInt(linkedProjectTaskIndex) : undefined,
      linkedOperationId: linkedOperationId || undefined,
    };

    // Add content based on type
    if (type === 'text') {
      submitData.textContent = textContent || undefined;
    } else if (type === 'file') {
      if (file) {
        submitData.file = file;
      }
    } else {
      // For link and other types, allow URL
      submitData.url = url || undefined;
    }

    onSubmit(submitData);
  };

  const typeOptions: { value: AssetType; label: string }[] = [
    { value: 'link', label: 'Link' },
    { value: 'file', label: 'File Upload' },
    { value: 'text', label: 'Text' },
    { value: 'spreadsheet', label: 'Spreadsheet' },
    { value: 'document', label: 'Document' },
    { value: 'tool', label: 'Tool' },
    { value: 'folder', label: 'Folder' },
    { value: 'screenshot', label: 'Screenshot' },
    { value: 'other', label: 'Other' },
  ];

  const projectOptions = [
    { value: '', label: 'None' },
    ...projects.map((p) => ({ value: p._id.toString(), label: p.name })),
  ];

  const operationOptions = [
    { value: '', label: 'None' },
    ...operations.map((o) => ({ value: o._id.toString(), label: o.name })),
  ];

  const showUrlInput = type !== 'file' && type !== 'text';
  const showFileInput = type === 'file';
  const showTextInput = type === 'text';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Asset Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Select
        label="Type"
        value={type}
        onChange={(e) => setType(e.target.value as AssetType)}
        options={typeOptions}
        required
      />
      
      {showUrlInput && (
        <Input
          label="URL (optional)"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
      )}

      {showFileInput && (
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            File {asset?.fileUrl ? '(current file will be replaced)' : ''}
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            required={!asset?.fileUrl}
          />
          {file && (
            <p className="mt-1 text-sm text-text-secondary">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>
      )}

      {showTextInput && (
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Text Content
          </label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
            placeholder="Enter your text content here..."
          />
        </div>
      )}

      <Input
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Input
        label="Category (optional)"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="e.g., Marketing, Engineering"
      />
      <Input
        label="Tags (comma-separated, optional)"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="tag1, tag2, tag3"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Linked Project (optional)"
          value={linkedProjectId}
          onChange={(e) => setLinkedProjectId(e.target.value)}
          options={projectOptions}
        />
        {linkedProjectId && selectedProjectTasks.length > 0 && (
          <Select
            label="Linked Task (optional)"
            value={linkedProjectTaskId || (linkedProjectTaskIndex !== '' ? `index-${linkedProjectTaskIndex}` : '')}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                setLinkedProjectTaskId('');
                setLinkedProjectTaskIndex('');
                return;
              }
              if (v.startsWith('index-')) {
                setLinkedProjectTaskIndex(v.slice(6));
                setLinkedProjectTaskId('');
              } else {
                setLinkedProjectTaskId(v);
                setLinkedProjectTaskIndex('');
              }
            }}
            options={[
              { value: '', label: 'None' },
              ...selectedProjectTasks.map((task) => ({
                value: task.id || `index-${task.index}`,
                label: `Task ${task.index + 1}: ${task.name}`,
              })),
            ]}
          />
        )}
        <Select
          label="Linked Operation (optional)"
          value={linkedOperationId}
          onChange={(e) => setLinkedOperationId(e.target.value)}
          options={operationOptions}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {asset ? 'Update' : 'Create'} Asset
        </Button>
      </div>
    </form>
  );
}
