'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { formatDate } from '@/lib/utils/dateUtils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import CommentThread from '@/components/comments/CommentThread';

interface ProjectDetailViewProps {
  project: IProject;
  isManagerOrAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function ProjectDetailView({ project, isManagerOrAdmin = false, onEdit, onDelete, onClose }: ProjectDetailViewProps) {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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

  const handleStatusChange = async (newStatus: 'in-review') => {
    if (project.status !== 'active' || newStatus !== 'in-review') {
      return; // Only allow active -> in-review
    }

    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/projects/${project._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // Reload the page to show updated status
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this project?')) {
      onDelete?.();
    }
  };

  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto">
      {/* Project Header */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-6 h-6 rounded"
            style={{ backgroundColor: project.color }}
          />
          <h2 className="text-2xl font-bold text-text-primary">{project.name}</h2>
          <span className={`text-sm px-3 py-1 rounded ${
            project.status === 'active' ? 'bg-success-light text-success-dark' :
            project.status === 'in-review' ? 'bg-warning-light text-warning-dark' :
            project.status === 'complete' ? 'bg-border text-text-secondary' :
            'bg-primary-light text-primary-dark'
          }`}>
            {project.status}
          </span>
        </div>
        {project.description && (
          <p className="text-text-secondary mb-4">{project.description}</p>
        )}
      </div>

      {/* Project Details */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-text-secondary">Start Date</label>
            <p className="text-text-primary">{formatDate(new Date(project.startDate))}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary">End Date</label>
            <p className="text-text-primary">{formatDate(new Date(project.endDate))}</p>
          </div>
          {project.estimatedHours && (
            <div>
              <label className="text-sm font-medium text-text-secondary">Estimated Hours</label>
              <p className="text-text-primary">{project.estimatedHours}h</p>
            </div>
          )}
          {project.assignedTo && (
            <div>
              <label className="text-sm font-medium text-text-secondary">Assigned To</label>
              <p className="text-text-primary">{project.assignedTo}</p>
            </div>
          )}
          {project.url && (
            <div className="col-span-2">
              <label className="text-sm font-medium text-text-secondary">URL</label>
              <p className="text-text-primary">
                <a href={project.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-hover transition-colors">
                  {project.url}
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
          entityType="project"
          entityId={project._id.toString()}
          currentUserId={currentUserId}
          showHeading={false}
        />
      </div>

      {/* Stages */}
      {project.stages && project.stages.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-text-primary">Stages</h3>
          {project.stages.map((stage, index) => (
            <Card key={index} className="p-4">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-lg font-semibold text-text-primary">
                    Stage {index + 1}: {stage.name}
                  </h4>
                  <span className={`text-xs px-2 py-1 rounded ${
                    stage.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    stage.status === 'in-review' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    stage.status === 'complete' ? 'bg-border text-text-secondary' :
                    'bg-primary-light text-primary-dark'
                  }`}>
                    {stage.status}
                  </span>
                </div>
                {stage.description && (
                  <p className="text-text-secondary mb-3">{stage.description}</p>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-xs font-medium text-text-secondary">Start Date</label>
                    <p className="text-text-primary">{formatDate(new Date(stage.startDate))}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary">End Date</label>
                    <p className="text-text-primary">{formatDate(new Date(stage.endDate))}</p>
                  </div>
                  {stage.estimatedHours && (
                    <div>
                      <label className="text-xs font-medium text-text-secondary">Estimated Hours</label>
                      <p className="text-text-primary">{stage.estimatedHours}h</p>
                    </div>
                  )}
                  {stage.assignedTo && (
                    <div>
                      <label className="text-xs font-medium text-text-secondary">Assigned To</label>
                      <p className="text-text-primary">{stage.assignedTo}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Comments */}
              <div className="border-t border-border pt-4 mt-4">
                <CommentThread
                  entityType="projectStage"
                  entityId={project._id.toString()}
                  stageIndex={index}
                  currentUserId={currentUserId}
                  showHeading={true}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t border-border">
        <Button
          variant="secondary"
          onClick={() => {
            router.push(`/assets?projectId=${project._id}`);
            onClose();
          }}
        >
          View Assets
        </Button>
      </div>
    </div>
  );
}
