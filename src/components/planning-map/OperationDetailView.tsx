'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IOperation } from '@/lib/models/Operation';
import { formatDate } from '@/lib/utils/dateUtils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import CommentThread from '@/components/comments/CommentThread';

interface OperationDetailViewProps {
  operation: IOperation;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function OperationDetailView({ operation, onEdit, onDelete, onClose }: OperationDetailViewProps) {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  useEffect(() => {
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

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this operation?')) {
      onDelete?.();
    }
  };

  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto">
      {/* Operation Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-2xl font-bold text-text-primary">{operation.name}</h2>
            <span className="text-sm px-3 py-1 rounded bg-accent-light text-accent-dark">
              {operation.recurrenceType}
            </span>
            <span className={`text-sm px-3 py-1 rounded ${
              operation.status === 'active' ? 'bg-success-light text-success-dark' :
              operation.status === 'in-review' ? 'bg-warning-light text-warning-dark' :
              operation.status === 'complete' ? 'bg-border text-text-secondary' :
              'bg-accent-light text-accent-dark'
            }`}>
              {operation.status}
            </span>
          </div>
          {operation.description && (
            <p className="text-text-secondary mb-4">{operation.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="secondary" size="sm" onClick={onEdit}>
              Edit
            </Button>
          )}
          {onDelete && (
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Operation Details */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Operation Details</h3>
        <div className="grid grid-cols-2 gap-4">
          {operation.startDate && (
            <div>
              <label className="text-sm font-medium text-text-secondary">Start Date</label>
              <p className="text-text-primary">{formatDate(new Date(operation.startDate))}</p>
            </div>
          )}
          {operation.endDate && (
            <div>
              <label className="text-sm font-medium text-text-secondary">End Date</label>
              <p className="text-text-primary">{formatDate(new Date(operation.endDate))}</p>
            </div>
          )}
          {operation.estimatedHours && (
            <div>
              <label className="text-sm font-medium text-text-secondary">Estimated Hours</label>
              <p className="text-text-primary">{operation.estimatedHours}h</p>
            </div>
          )}
          {operation.assignedTo && (
            <div>
              <label className="text-sm font-medium text-text-secondary">Assigned To</label>
              <p className="text-text-primary">{operation.assignedTo}</p>
            </div>
          )}
          {operation.url && (
            <div className="col-span-2">
              <label className="text-sm font-medium text-text-secondary">URL</label>
              <p className="text-text-primary">
                <a href={operation.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">
                  {operation.url}
                </a>
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Comments */}
      <div className="border-t border-border pt-4">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Comments</h3>
        <CommentThread
          entityType="operation"
          entityId={operation._id.toString()}
          currentUserId={currentUserId}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-border">
        <Button
          variant="secondary"
          onClick={() => {
            router.push(`/assets?operationId=${operation._id}`);
            onClose();
          }}
        >
          View Assets
        </Button>
      </div>
    </div>
  );
}
