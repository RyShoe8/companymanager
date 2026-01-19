'use client';

import { IOperation } from '@/lib/models/Operation';
import Card from '@/components/ui/Card';

interface OperationListProps {
  operations: IOperation[];
  onEdit?: (operation: IOperation) => void;
  onDelete?: (id: string) => void;
}

export default function OperationList({ operations, onEdit, onDelete }: OperationListProps) {
  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this operation?')) {
      onDelete?.(id);
    }
  };

  if (operations.length === 0) {
    return (
      <div className="text-center py-8 text-text-secondary">
        No operations for this time horizon
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold text-text-primary mb-3">Operations</h3>
      {operations.map((operation) => (
        <Card
          key={operation._id.toString()}
          className="p-4"
          onClick={() => onEdit?.(operation)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-medium text-text-primary">{operation.name}</h4>
                <span className="text-xs px-2 py-1 rounded bg-accent-light text-accent-dark">
                  {operation.recurrenceType === 'none' ? 'Non Recurring' : operation.recurrenceType}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${
                  operation.status === 'active' ? 'bg-success-light text-success-dark' :
                  operation.status === 'in-review' ? 'bg-warning-light text-warning-dark' :
                  operation.status === 'complete' ? 'bg-border text-text-secondary' :
                  'bg-accent-light text-accent-dark'
                }`}>
                  {operation.status}
                </span>
              </div>
              {operation.description && (
                <p className="text-sm text-text-secondary">{operation.description}</p>
              )}
            </div>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(operation._id.toString());
                }}
                className="ml-2 text-error hover:text-error-dark transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
