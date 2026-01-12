'use client';

import { useState } from 'react';
import { IOperation, RecurrenceType, OperationStatus } from '@/lib/models/Operation';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

interface OperationFormProps {
  operation?: IOperation;
  recurrenceType: RecurrenceType;
  onSubmit: (data: Partial<IOperation>) => void;
  onCancel: () => void;
}

export default function OperationForm({ operation, recurrenceType, onSubmit, onCancel }: OperationFormProps) {
  const [name, setName] = useState(operation?.name || '');
  const [description, setDescription] = useState(operation?.description || '');
  const [status, setStatus] = useState<OperationStatus>(operation?.status || 'planned');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      recurrenceType,
      status,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Operation Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Input
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Select
        label="Status"
        value={status}
        onChange={(e) => setStatus(e.target.value as OperationStatus)}
        options={[
          { value: 'planned', label: 'Planned' },
          { value: 'active', label: 'Active' },
          { value: 'complete', label: 'Complete' },
        ]}
      />
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {operation ? 'Update' : 'Create'} Operation
        </Button>
      </div>
    </form>
  );
}
