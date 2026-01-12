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
  onSubmit: (data: Omit<Partial<IAsset>, 'linkedProjectId' | 'linkedOperationId'> & { linkedProjectId?: string; linkedOperationId?: string }) => void;
  onCancel: () => void;
}

export default function AssetForm({ asset, projects = [], operations = [], onSubmit, onCancel }: AssetFormProps) {
  const [name, setName] = useState(asset?.name || '');
  const [type, setType] = useState<AssetType>(asset?.type || 'link');
  const [url, setUrl] = useState(asset?.url || '');
  const [description, setDescription] = useState(asset?.description || '');
  const [category, setCategory] = useState(asset?.category || '');
  const [tags, setTags] = useState(asset?.tags?.join(', ') || '');
  const [linkedProjectId, setLinkedProjectId] = useState(asset?.linkedProjectId?.toString() || '');
  const [linkedOperationId, setLinkedOperationId] = useState(asset?.linkedOperationId?.toString() || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tagArray = tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    onSubmit({
      name,
      type,
      url: url || undefined,
      description: description || undefined,
      category: category || undefined,
      tags: tagArray,
      linkedProjectId: linkedProjectId || undefined,
      linkedOperationId: linkedOperationId || undefined,
    });
  };

  const typeOptions: { value: AssetType; label: string }[] = [
    { value: 'spreadsheet', label: 'Spreadsheet' },
    { value: 'document', label: 'Document' },
    { value: 'tool', label: 'Tool' },
    { value: 'folder', label: 'Folder' },
    { value: 'link', label: 'Link' },
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
      <Input
        label="URL (optional)"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
      />
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
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Linked Project (optional)"
          value={linkedProjectId}
          onChange={(e) => setLinkedProjectId(e.target.value)}
          options={projectOptions}
        />
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
