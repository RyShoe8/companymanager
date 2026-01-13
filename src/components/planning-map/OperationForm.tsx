'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IOperation, RecurrenceType, OperationStatus } from '@/lib/models/Operation';
import { IEmployee } from '@/lib/models/Employee';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import CommentThread from '@/components/comments/CommentThread';

interface OperationFormProps {
  operation?: IOperation;
  recurrenceType?: RecurrenceType;
  onSubmit: (data: Partial<IOperation>) => void;
  onCancel: () => void;
}

export default function OperationForm({ operation, recurrenceType = 'weekly', onSubmit, onCancel }: OperationFormProps) {
  const router = useRouter();
  const [name, setName] = useState(operation?.name || '');
  const [description, setDescription] = useState(operation?.description || '');
  const [url, setUrl] = useState(operation?.url || '');
  const [status, setStatus] = useState<OperationStatus>(operation?.status || 'planning');
  const [assignedTo, setAssignedTo] = useState(operation?.assignedTo || '');
  const [estimatedHours, setEstimatedHours] = useState(operation?.estimatedHours?.toString() || '');
  const [startDate, setStartDate] = useState(
    operation?.startDate ? new Date(operation.startDate).toISOString().split('T')[0] : ''
  );
  const [endDate, setEndDate] = useState(
    operation?.endDate ? new Date(operation.endDate).toISOString().split('T')[0] : ''
  );
  const [currentRecurrenceType, setCurrentRecurrenceType] = useState<RecurrenceType>(operation?.recurrenceType || recurrenceType);
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  useEffect(() => {
    // Fetch employees for the dropdown
    const fetchEmployees = async () => {
      try {
        const response = await fetch('/api/employees');
        if (response.ok) {
          const data = await response.json();
          setEmployees(data);
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
      }
    };
    fetchEmployees();

    // Fetch current user ID
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.id);
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    };
    fetchCurrentUser();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData: Partial<IOperation> = {
      name,
      description,
      url: url || undefined,
      recurrenceType: currentRecurrenceType,
      status,
    };
    if (assignedTo) {
      submitData.assignedTo = assignedTo;
    }
    if (estimatedHours) {
      submitData.estimatedHours = parseFloat(estimatedHours);
    }
    if (startDate) {
      submitData.startDate = new Date(startDate);
    }
    if (endDate) {
      submitData.endDate = new Date(endDate);
    }
    onSubmit(submitData);
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
      <Input
        label="URL (optional)"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com"
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Start Date (optional)"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          label="End Date (optional)"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Recurrence"
          value={currentRecurrenceType}
          onChange={(e) => setCurrentRecurrenceType(e.target.value as RecurrenceType)}
          options={[
            { value: 'weekly', label: 'Weekly' },
            { value: 'bi-weekly', label: 'Bi-weekly' },
            { value: 'monthly', label: 'Monthly' },
          ]}
        />
        <Input
          label="Estimated Hours (optional)"
          type="number"
          min="0"
          step="0.5"
          value={estimatedHours}
          onChange={(e) => setEstimatedHours(e.target.value)}
          placeholder="e.g., 8"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as OperationStatus)}
          options={[
            { value: 'planning', label: 'Planning' },
            { value: 'active', label: 'Active' },
            { value: 'complete', label: 'Complete' },
          ]}
        />
        <Select
          label="Assigned To (optional)"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          options={[
            { value: '', label: 'None' },
            ...employees.map(emp => ({ value: emp.name, label: emp.name }))
          ]}
        />
      </div>

      {/* Comments Section */}
      {operation && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <CommentThread
            entityType="operation"
            entityId={operation._id.toString()}
            currentUserId={currentUserId}
          />
        </div>
      )}

      <div className="flex gap-2 justify-between items-center">
        {operation && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              router.push(`/assets?operationId=${operation._id}`);
              onCancel();
            }}
          >
            View Assets
          </Button>
        )}
        <div className="flex gap-2 ml-auto">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {operation ? 'Update' : 'Create'} Operation
          </Button>
        </div>
      </div>
    </form>
  );
}
