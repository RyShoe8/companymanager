'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { IOperation } from '@/lib/models/Operation';
import { formatDate } from '@/lib/utils/dateUtils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import CommentThread from '@/components/comments/CommentThread';
import Modal from '@/components/ui/Modal';
import AssetForm from '@/components/assets/AssetForm';
import { IAsset } from '@/lib/models/Asset';

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
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  
  // Load expanded operations from localStorage on mount
  const [expandedOperations, setExpandedOperations] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`project-${project._id.toString()}-expanded-operations`);
      if (saved) {
        try {
          const operationIds = JSON.parse(saved);
          return new Set(operationIds);
        } catch (e) {
          return new Set();
        }
      }
    }
    return new Set();
  });
  
  // Save expanded operations to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const operationIds = Array.from(expandedOperations);
      localStorage.setItem(`project-${project._id.toString()}-expanded-operations`, JSON.stringify(operationIds));
    }
  }, [expandedOperations, project._id]);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [assetFormTaskIndex, setAssetFormTaskIndex] = useState<number | undefined>(undefined);
  const [assetFormOperationId, setAssetFormOperationId] = useState<string | undefined>(undefined);
  const [operationScreenshots, setOperationScreenshots] = useState<Map<string, IAsset[]>>(new Map());
  const [projects, setProjects] = useState<Array<{ _id: string; name: string }>>([]);
  const [operations, setOperations] = useState<Array<{ _id: string; name: string }>>([]);
  const [projectAssets, setProjectAssets] = useState<IAsset[]>([]);
  const [taskAssets, setTaskAssets] = useState<Map<number, IAsset[]>>(new Map());
  const [projectScreenshots, setProjectScreenshots] = useState<IAsset[]>([]);
  const [taskScreenshots, setTaskScreenshots] = useState<Map<number, IAsset[]>>(new Map());
  const [projectOperations, setProjectOperations] = useState<IOperation[]>([]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data && data.id) {
            setCurrentUserId(data.id);
          }
        }
      } catch (error) {
        // Error fetching current user
      }
    };
    fetchCurrentUser();

    // Fetch projects and operations for asset form
    const fetchData = async () => {
      try {
        const [projectsRes, operationsRes, assetsRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/operations'),
          fetch(`/api/assets?linkedProjectId=${project._id}`),
        ]);
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setProjects(projectsData.map((p: IProject) => ({ _id: p._id.toString(), name: p.name })));
        }
        if (operationsRes.ok) {
          const operationsData = await operationsRes.json();
          setOperations(operationsData.map((o: any) => ({ _id: o._id.toString(), name: o.name })));
          
          // If project is launched, fetch operations linked to this project
          if (project.status === 'launched') {
            const linkedOperations = operationsData.filter((o: any) => 
              o.projectId?.toString() === project._id.toString()
            );
            setProjectOperations(linkedOperations);
          }
        }
        if (assetsRes.ok) {
          const assetsData = await assetsRes.json();
          // Filter assets for the project (without task)
          const projectOnlyAssets = assetsData.filter((asset: IAsset) => 
            asset.linkedProjectId?.toString() === project._id.toString() && 
            asset.linkedProjectTaskIndex === undefined &&
            asset.linkedOperationId === undefined
          );
          setProjectAssets(projectOnlyAssets);

          // Filter screenshots for the project (without task)
          const projectOnlyScreenshots = assetsData.filter((asset: IAsset) => 
            asset.linkedProjectId?.toString() === project._id.toString() && 
            asset.linkedProjectTaskIndex === undefined &&
            asset.linkedOperationId === undefined &&
            asset.type === 'screenshot'
          );
          setProjectScreenshots(projectOnlyScreenshots);

          // Group assets by task index
          const taskAssetsMap = new Map<number, IAsset[]>();
          const taskScreenshotsMap = new Map<number, IAsset[]>();
          assetsData.forEach((asset: IAsset) => {
            if (asset.linkedProjectId?.toString() === project._id.toString() && 
                asset.linkedProjectTaskIndex !== undefined) {
              const taskIdx = asset.linkedProjectTaskIndex;
              if (asset.type === 'screenshot') {
                if (!taskScreenshotsMap.has(taskIdx)) {
                  taskScreenshotsMap.set(taskIdx, []);
                }
                taskScreenshotsMap.get(taskIdx)!.push(asset);
              } else {
                if (!taskAssetsMap.has(taskIdx)) {
                  taskAssetsMap.set(taskIdx, []);
                }
                taskAssetsMap.get(taskIdx)!.push(asset);
              }
            }
          });
          setTaskAssets(taskAssetsMap);
          setTaskScreenshots(taskScreenshotsMap);

          // Group screenshots by operation ID
          const operationScreenshotsMap = new Map<string, IAsset[]>();
          assetsData.forEach((asset: IAsset) => {
            if (asset.linkedOperationId) {
              const opId = asset.linkedOperationId.toString();
              if (asset.type === 'screenshot') {
                if (!operationScreenshotsMap.has(opId)) {
                  operationScreenshotsMap.set(opId, []);
                }
                operationScreenshotsMap.get(opId)!.push(asset);
              }
            }
          });
          setOperationScreenshots(operationScreenshotsMap);
        }
      } catch (error) {
        // Error fetching data
      }
    };
    fetchData();
  }, []);

  const handleStatusChange = async (newStatus: 'in-review') => {
    if (project.status !== 'in-development' || newStatus !== 'in-review') {
      return; // Only allow in-development -> in-review
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
      // Error updating status
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

  const toggleTask = (index: number) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleOperation = (operationId: string) => {
    setExpandedOperations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(operationId)) {
        newSet.delete(operationId);
      } else {
        newSet.add(operationId);
      }
      return newSet;
    });
  };

  const handleAddAsset = (taskIndex?: number, operationId?: string) => {
    setAssetFormTaskIndex(taskIndex);
    setAssetFormOperationId(operationId);
    setShowAssetForm(true);
  };

  const handleAddScreenshot = (taskIndex?: number, operationId?: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await handleUploadScreenshots(Array.from(files), taskIndex);
      }
    };
    input.click();
  };

  const handleUploadScreenshots = async (files: File[], taskIndex?: number, operationId?: string) => {
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name.replace(/\.[^/.]+$/, '') || 'Screenshot');
        formData.append('type', 'screenshot');
        if (operationId) {
          formData.append('linkedOperationId', operationId);
        } else {
          formData.append('linkedProjectId', project._id.toString());
          if (taskIndex !== undefined) {
            formData.append('linkedProjectTaskIndex', taskIndex.toString());
          }
        }

        const response = await fetch('/api/assets/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
        return response.json();
      });

      await Promise.all(uploadPromises);
      
      // Refresh assets
      const assetsRes = await fetch(`/api/assets?linkedProjectId=${project._id}`);
      if (assetsRes.ok) {
        const assetsData = await assetsRes.json();
        // Filter assets for the project (without task)
        const projectOnlyAssets = assetsData.filter((asset: IAsset) => 
          asset.linkedProjectId?.toString() === project._id.toString() && 
          asset.linkedProjectTaskIndex === undefined &&
          asset.type !== 'screenshot'
        );
        setProjectAssets(projectOnlyAssets);

        // Filter screenshots for the project (without task)
        const projectOnlyScreenshots = assetsData.filter((asset: IAsset) => 
          asset.linkedProjectId?.toString() === project._id.toString() && 
          asset.linkedProjectTaskIndex === undefined &&
          asset.type === 'screenshot'
        );
        setProjectScreenshots(projectOnlyScreenshots);

        // Group assets by task index
        const taskAssetsMap = new Map<number, IAsset[]>();
        const taskScreenshotsMap = new Map<number, IAsset[]>();
        assetsData.forEach((asset: IAsset) => {
          if (asset.linkedProjectId?.toString() === project._id.toString() && 
              asset.linkedProjectTaskIndex !== undefined) {
            const taskIdx = asset.linkedProjectTaskIndex;
            if (asset.type === 'screenshot') {
              if (!taskScreenshotsMap.has(taskIdx)) {
                taskScreenshotsMap.set(taskIdx, []);
              }
              taskScreenshotsMap.get(taskIdx)!.push(asset);
            } else {
              if (!taskAssetsMap.has(taskIdx)) {
                taskAssetsMap.set(taskIdx, []);
              }
              taskAssetsMap.get(taskIdx)!.push(asset);
            }
          }
        });
        setTaskAssets(taskAssetsMap);
        setTaskScreenshots(taskScreenshotsMap);
      }
    } catch (error) {
      // Error uploading screenshots
      alert('Failed to upload screenshots');
    }
  };

  const handleSubmitAsset = async (data: Omit<Partial<IAsset>, 'linkedProjectId' | 'linkedOperationId'> & { linkedProjectId?: string; linkedOperationId?: string; linkedProjectTaskIndex?: number; file?: File }) => {
    try {
      // Set the project/task/operation if provided
      const submitData: any = {
        ...data,
      };
      if (assetFormOperationId) {
        submitData.linkedOperationId = assetFormOperationId;
      } else {
        submitData.linkedProjectId = project._id.toString();
        submitData.linkedProjectTaskIndex = assetFormTaskIndex;
      }

      let response;
      if (data.file) {
        // Use FormData for file uploads
        const formData = new FormData();
        formData.append('file', data.file);
        formData.append('name', submitData.name);
        formData.append('type', submitData.type);
        if (submitData.description) formData.append('description', submitData.description);
        if (submitData.category) formData.append('category', submitData.category);
        if (submitData.tags) formData.append('tags', JSON.stringify(submitData.tags));
        if (submitData.url) formData.append('url', submitData.url);
        if (submitData.textContent) formData.append('textContent', submitData.textContent);
        if (submitData.linkedProjectId) {
          formData.append('linkedProjectId', submitData.linkedProjectId);
        }
        if (submitData.linkedProjectTaskIndex !== undefined) {
          formData.append('linkedProjectTaskIndex', submitData.linkedProjectTaskIndex.toString());
        }
        if (submitData.linkedOperationId) {
          formData.append('linkedOperationId', submitData.linkedOperationId);
        }

        response = await fetch('/api/assets/upload', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Use JSON for non-file assets
        const { file, ...jsonData } = submitData;
        response = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jsonData),
        });
      }

      if (response.ok) {
        setShowAssetForm(false);
        setAssetFormTaskIndex(undefined);
        setAssetFormOperationId(undefined);
        
        // Refresh assets
        try {
          const assetsRes = await fetch(`/api/assets?linkedProjectId=${project._id}`);
          if (assetsRes.ok) {
            const assetsData = await assetsRes.json();
            // Filter assets for the project (without task)
            const projectOnlyAssets = assetsData.filter((asset: IAsset) => 
              asset.linkedProjectId?.toString() === project._id.toString() && 
              asset.linkedProjectTaskIndex === undefined &&
              asset.linkedOperationId === undefined &&
              asset.type !== 'screenshot'
            );
            setProjectAssets(projectOnlyAssets);

            // Filter screenshots for the project (without task)
            const projectOnlyScreenshots = assetsData.filter((asset: IAsset) => 
              asset.linkedProjectId?.toString() === project._id.toString() && 
              asset.linkedProjectTaskIndex === undefined &&
              asset.linkedOperationId === undefined &&
              asset.type === 'screenshot'
            );
            setProjectScreenshots(projectOnlyScreenshots);

            // Group assets by task index
            const taskAssetsMap = new Map<number, IAsset[]>();
            const taskScreenshotsMap = new Map<number, IAsset[]>();
            assetsData.forEach((asset: IAsset) => {
              if (asset.linkedProjectId?.toString() === project._id.toString() && 
                  asset.linkedProjectTaskIndex !== undefined) {
                const taskIdx = asset.linkedProjectTaskIndex;
                if (asset.type === 'screenshot') {
                  if (!taskScreenshotsMap.has(taskIdx)) {
                    taskScreenshotsMap.set(taskIdx, []);
                  }
                  taskScreenshotsMap.get(taskIdx)!.push(asset);
                } else {
                  if (!taskAssetsMap.has(taskIdx)) {
                    taskAssetsMap.set(taskIdx, []);
                  }
                  taskAssetsMap.get(taskIdx)!.push(asset);
                }
              }
            });
            setTaskAssets(taskAssetsMap);
            setTaskScreenshots(taskScreenshotsMap);

            // Group screenshots by operation ID
            const operationScreenshotsMap = new Map<string, IAsset[]>();
            assetsData.forEach((asset: IAsset) => {
              if (asset.linkedOperationId) {
                const opId = asset.linkedOperationId.toString();
                if (asset.type === 'screenshot') {
                  if (!operationScreenshotsMap.has(opId)) {
                    operationScreenshotsMap.set(opId, []);
                  }
                  operationScreenshotsMap.get(opId)!.push(asset);
                }
              }
            });
            setOperationScreenshots(operationScreenshotsMap);
          }
        } catch (error) {
          // Error refreshing assets
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create asset');
      }
    } catch (error) {
      // Error creating asset
      alert('Failed to create asset');
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
          <h2 className={`text-2xl font-bold text-text-primary ${project.status === 'completed' ? 'line-through opacity-75' : ''}`}>{project.name}</h2>
          <span className={`text-sm px-3 py-1 rounded ${
            project.status === 'completed' ? 'bg-border text-text-secondary' :
            project.status === 'in-development' ? 'bg-success-light text-success-dark' :
            project.status === 'in-review' ? 'bg-warning-light text-warning-dark' :
            project.status === 'launched' ? 'bg-border text-text-secondary' :
            'bg-primary-light text-primary-dark'
          }`}>
            {project.status === 'completed' ? 'Completed' :
             project.status === 'in-development' ? 'In Development' :
             project.status === 'in-review' ? 'In Review' :
             project.status === 'launched' ? 'Launched' :
             'Planning'}
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
            <p className="text-text-primary">
              {(() => {
                // Parse date to avoid timezone issues - extract YYYY-MM-DD and create local date
                const startDateObj = new Date(project.startDate);
                const startDateStr = startDateObj.toISOString().split('T')[0];
                const [year, month, day] = startDateStr.split('-').map(Number);
                const localDate = new Date(year, month - 1, day);
                return formatDate(localDate);
              })()}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary">End Date</label>
            <p className="text-text-primary">
              {(() => {
                // Parse date to avoid timezone issues - extract YYYY-MM-DD and create local date
                const endDateObj = new Date(project.endDate);
                const endDateStr = endDateObj.toISOString().split('T')[0];
                const [year, month, day] = endDateStr.split('-').map(Number);
                const localDate = new Date(year, month - 1, day);
                return formatDate(localDate);
              })()}
            </p>
          </div>
          <div className="col-span-2">
            <div className="flex gap-2 mb-2">
              {projectAssets.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    router.push(`/assets?projectId=${project._id}`);
                    onClose();
                  }}
                >
                  View Assets
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => handleAddAsset()}
              >
                Add Asset
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleAddScreenshot()}
              >
                Add Screenshot
              </Button>
            </div>
            {projectScreenshots.length > 0 && (
              <div className="mt-2">
                <label className="text-xs font-medium text-text-secondary mb-1 block">Screenshots</label>
                <div className="grid grid-cols-4 gap-2">
                  {projectScreenshots.map((screenshot) => (
                    <div key={screenshot._id.toString()} className="relative group">
                      <img
                        src={screenshot.fileUrl}
                        alt={screenshot.name}
                        className="w-full h-20 object-cover rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(screenshot.fileUrl, '_blank')}
                      />
                      <p className="text-xs text-text-secondary mt-1 truncate" title={screenshot.name}>
                        {screenshot.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
          {(project.urls && project.urls.length > 0) || project.url ? (
            <div className="col-span-2">
              <label className="text-sm font-medium text-text-secondary">URLs</label>
              <div className="space-y-1">
                {/* Show new urls array if available */}
                {project.urls && project.urls.length > 0 ? (
                  project.urls.map((url, index) => (
                    <p key={index} className="text-text-primary">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-hover transition-colors">
                        {url}
                      </a>
                    </p>
                  ))
                ) : (
                  /* Fallback to legacy url field */
                  project.url && (
                    <p className="text-text-primary">
                      <a href={project.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-hover transition-colors">
                        {project.url}
                      </a>
                    </p>
                  )
                )}
              </div>
            </div>
          ) : null}
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

      {/* Tasks or Operations */}
      {project.status === 'launched' && projectOperations.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-text-primary">Operations</h3>
          {projectOperations.map((operation, index) => {
            const operationId = operation._id.toString();
            const operationAssets = projectAssets.filter(a => 
              a.linkedOperationId?.toString() === operationId
            );
            const opScreenshots = operationScreenshots.get(operationId) || [];
            const isExpanded = expandedOperations.has(operationId);
            return (
              <Card key={operationId} className="p-4">
                {/* Collapsible Header */}
                <button
                  onClick={() => toggleOperation(operationId)}
                  className="w-full flex items-center justify-between mb-2 hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-2 flex-1 text-left">
                    <svg
                      className={`w-4 h-4 text-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <h4 className="text-lg font-semibold text-text-primary">
                      Operation {index + 1}: {operation.name}
                    </h4>
                    <span className={`text-xs px-2 py-1 rounded ${
                      operation.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      operation.status === 'in-review' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      operation.status === 'complete' ? 'bg-border text-text-secondary' :
                      'bg-primary-light text-primary-dark'
                    }`}>
                      {operation.status === 'active' ? 'Active' :
                       operation.status === 'in-review' ? 'In Review' :
                       operation.status === 'complete' ? 'Complete' :
                       'Planning'}
                    </span>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <>
                    {operation.description && (
                      <p className="text-text-secondary mb-3">{operation.description}</p>
                    )}
                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      {operation.startDate && (
                        <div>
                          <label className="text-xs font-medium text-text-secondary">Start Date</label>
                          <p className="text-text-primary">{formatDate(new Date(operation.startDate))}</p>
                        </div>
                      )}
                      {operation.endDate && (
                        <div>
                          <label className="text-xs font-medium text-text-secondary">End Date</label>
                          <p className="text-text-primary">{formatDate(new Date(operation.endDate))}</p>
                        </div>
                      )}
                      {operation.estimatedHours && (
                        <div>
                          <label className="text-xs font-medium text-text-secondary">Estimated Hours</label>
                          <p className="text-text-primary">{operation.estimatedHours}h</p>
                        </div>
                      )}
                      {operation.assignedTo && (
                        <div>
                          <label className="text-xs font-medium text-text-secondary">Assigned To</label>
                          <p className="text-text-primary">{operation.assignedTo}</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                      <div className="flex gap-2 mb-2">
                        {operationAssets.length > 0 && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              router.push(`/assets?operationId=${operationId}`);
                              onClose();
                            }}
                          >
                            View Assets
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleAddAsset(undefined, operationId)}
                        >
                          Add Asset
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleAddScreenshot(undefined, operationId)}
                        >
                          Add Screenshot
                        </Button>
                      </div>
                      {opScreenshots.length > 0 && (
                        <div className="mt-2">
                          <label className="text-xs font-medium text-text-secondary mb-1 block">Screenshots</label>
                          <div className="grid grid-cols-4 gap-2">
                            {opScreenshots.map((screenshot) => (
                              <div key={screenshot._id.toString()} className="relative group">
                                <img
                                  src={screenshot.fileUrl}
                                  alt={screenshot.name}
                                  className="w-full h-20 object-cover rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => window.open(screenshot.fileUrl, '_blank')}
                                />
                                <p className="text-xs text-text-secondary mt-1 truncate" title={screenshot.name}>
                                  {screenshot.name}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 border-t border-border pt-3">
                      <CommentThread
                        entityType="operation"
                        entityId={operationId}
                        currentUserId={currentUserId}
                        showHeading={false}
                      />
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      ) : project.tasks && project.tasks.filter(t => t.status !== 'complete').length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-text-primary">Tasks</h3>
          {project.tasks
            .map((task, originalIndex) => ({ task, originalIndex }))
            .filter(({ task }) => task.status !== 'complete')
            .map(({ task, originalIndex: index }) => {
            const isExpanded = expandedTasks.has(index);
            return (
              <Card key={index} className="p-4">
                {/* Collapsible Header */}
                <button
                  onClick={() => toggleTask(index)}
                  className="w-full flex items-center justify-between mb-2 hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-2 flex-1 text-left">
                    <svg
                      className={`w-4 h-4 text-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <h4 className="text-lg font-semibold text-text-primary">
                      Task {index + 1}: {task.name}
                    </h4>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    task.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    task.status === 'in-review' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    task.status === 'complete' ? 'bg-border text-text-secondary' :
                    'bg-primary-light text-primary-dark'
                  }`}>
                    {task.status === 'active' ? 'Active' :
                     task.status === 'in-review' ? 'In Review' :
                     task.status === 'complete' ? 'Complete' :
                     'Planning'}
                  </span>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="mb-4">
                    {task.description && (
                      <p className="text-text-secondary mb-3">{task.description}</p>
                    )}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <label className="text-xs font-medium text-text-secondary">Start Date</label>
                        <p className="text-text-primary">{formatDate(new Date(task.startDate))}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-text-secondary">End Date</label>
                        <p className="text-text-primary">{formatDate(new Date(task.endDate))}</p>
                      </div>
                      {task.estimatedHours && (
                        <div>
                          <label className="text-xs font-medium text-text-secondary">Estimated Hours</label>
                          <p className="text-text-primary">{task.estimatedHours}h</p>
                        </div>
                      )}
                      {task.assignedTo && (
                        <div>
                          <label className="text-xs font-medium text-text-secondary">Assigned To</label>
                          <p className="text-text-primary">{task.assignedTo}</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                      <div className="flex gap-2 mb-2">
                        {taskAssets.get(index) && taskAssets.get(index)!.length > 0 && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              router.push(`/assets?projectId=${project._id}&taskIndex=${index}`);
                              onClose();
                            }}
                          >
                            View Assets
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleAddAsset(index)}
                        >
                          Add Asset
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleAddScreenshot(index)}
                        >
                          Add Screenshot
                        </Button>
                      </div>
                      {taskScreenshots.get(index) && taskScreenshots.get(index)!.length > 0 && (
                        <div className="mt-2">
                          <label className="text-xs font-medium text-text-secondary mb-1 block">Screenshots</label>
                          <div className="grid grid-cols-4 gap-2">
                            {taskScreenshots.get(index)!.map((screenshot) => (
                              <div key={screenshot._id.toString()} className="relative group">
                                <img
                                  src={screenshot.fileUrl}
                                  alt={screenshot.name}
                                  className="w-full h-20 object-cover rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => window.open(screenshot.fileUrl, '_blank')}
                                />
                                <p className="text-xs text-text-secondary mt-1 truncate" title={screenshot.name}>
                                  {screenshot.name}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Comments */}
                {isExpanded && (
                  <div className="border-t border-border pt-4 mt-4">
                    <CommentThread
                      entityType="projectTask"
                      entityId={project._id.toString()}
                      taskIndex={index}
                      currentUserId={currentUserId}
                      showHeading={true}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Asset Form Modal */}
      <Modal
        isOpen={showAssetForm}
        onClose={() => {
          setShowAssetForm(false);
          setAssetFormTaskIndex(undefined);
        }}
        title="New Asset"
      >
        <AssetForm
          projects={projects}
          operations={operations}
          onSubmit={handleSubmitAsset}
          onCancel={() => {
            setShowAssetForm(false);
            setAssetFormTaskIndex(undefined);
          }}
        />
      </Modal>
    </div>
  );
}
