'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IOperation } from '@/lib/models/Operation';
import { formatDate } from '@/lib/utils/dateUtils';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import CommentThread from '@/components/comments/CommentThread';
import AssetForm from '@/components/assets/AssetForm';
import Modal from '@/components/ui/Modal';
import { IAsset } from '@/lib/models/Asset';

interface OperationDetailViewProps {
  operation: IOperation;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function OperationDetailView({ operation, onEdit, onDelete, onClose }: OperationDetailViewProps) {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [operationAssets, setOperationAssets] = useState<IAsset[]>([]);
  const [operationScreenshots, setOperationScreenshots] = useState<IAsset[]>([]);
  const [projects, setProjects] = useState<Array<{ _id: string; name: string }>>([]);
  const [operations, setOperations] = useState<Array<{ _id: string; name: string }>>([]);

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

    // Fetch projects and operations for asset form
    const fetchData = async () => {
      try {
        const [projectsRes, operationsRes, assetsRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/operations'),
          fetch(`/api/assets?linkedOperationId=${operation._id}`),
        ]);
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setProjects(projectsData.map((p: any) => ({ _id: p._id.toString(), name: p.name })));
        }
        if (operationsRes.ok) {
          const operationsData = await operationsRes.json();
          setOperations(operationsData.map((o: any) => ({ _id: o._id.toString(), name: o.name })));
        }
        if (assetsRes.ok) {
          const assetsData = await assetsRes.json();
          const assets = assetsData.filter((asset: IAsset) => 
            asset.linkedOperationId?.toString() === operation._id.toString() &&
            asset.type !== 'screenshot'
          );
          const screenshots = assetsData.filter((asset: IAsset) => 
            asset.linkedOperationId?.toString() === operation._id.toString() &&
            asset.type === 'screenshot'
          );
          setOperationAssets(assets);
          setOperationScreenshots(screenshots);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [operation._id]);

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this operation?')) {
      onDelete?.();
    }
  };

  const handleAddAsset = () => {
    setShowAssetForm(true);
  };

  const handleAddScreenshot = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await handleUploadScreenshots(Array.from(files));
      }
    };
    input.click();
  };

  const handleUploadScreenshots = async (files: File[]) => {
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name.replace(/\.[^/.]+$/, '') || 'Screenshot');
        formData.append('type', 'screenshot');
        formData.append('linkedOperationId', operation._id.toString());

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
      const assetsRes = await fetch(`/api/assets?linkedOperationId=${operation._id}`);
      if (assetsRes.ok) {
        const assetsData = await assetsRes.json();
        const assets = assetsData.filter((asset: IAsset) => 
          asset.linkedOperationId?.toString() === operation._id.toString() &&
          asset.type !== 'screenshot'
        );
        const screenshots = assetsData.filter((asset: IAsset) => 
          asset.linkedOperationId?.toString() === operation._id.toString() &&
          asset.type === 'screenshot'
        );
        setOperationAssets(assets);
        setOperationScreenshots(screenshots);
      }
    } catch (error) {
      console.error('Error uploading screenshots:', error);
      alert('Failed to upload screenshots');
    }
  };

  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto">
      <Card className="p-4">
        {/* Collapsible Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
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
            <h2 className="text-2xl font-bold text-text-primary">{operation.name}</h2>
            <span className="text-sm px-3 py-1 rounded bg-accent-light text-accent-dark">
              {operation.recurrenceType === 'none' ? 'Non Recurring' : operation.recurrenceType}
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
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <>
            {operation.description && (
              <p className="text-text-secondary mb-4">{operation.description}</p>
            )}

            {/* Operation Details */}
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              {operation.startDate && (
                <div>
                  <label className="text-xs font-medium text-text-secondary">Start Date</label>
                  <p className="text-text-primary">
                    {(() => {
                      const startDateObj = new Date(operation.startDate);
                      const startDateStr = startDateObj.toISOString().split('T')[0];
                      const [year, month, day] = startDateStr.split('-').map(Number);
                      const localDate = new Date(year, month - 1, day);
                      return formatDate(localDate);
                    })()}
                  </p>
                </div>
              )}
              {operation.endDate && (
                <div>
                  <label className="text-xs font-medium text-text-secondary">End Date</label>
                  <p className="text-text-primary">
                    {(() => {
                      const endDateObj = new Date(operation.endDate);
                      const endDateStr = endDateObj.toISOString().split('T')[0];
                      const [year, month, day] = endDateStr.split('-').map(Number);
                      const localDate = new Date(year, month - 1, day);
                      return formatDate(localDate);
                    })()}
                  </p>
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
              {operation.url && (
                <div className="col-span-2">
                  <label className="text-xs font-medium text-text-secondary">URL</label>
                  <p className="text-text-primary">
                    <a href={operation.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">
                      {operation.url}
                    </a>
                  </p>
                </div>
              )}
            </div>

            {/* Assets and Screenshots */}
            <div className="mt-4">
              <div className="flex gap-2 mb-2">
                {operationAssets.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      router.push(`/assets?operationId=${operation._id}`);
                      onClose();
                    }}
                  >
                    View Assets
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddAsset}
                >
                  Add Asset
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddScreenshot}
                >
                  Add Screenshot
                </Button>
              </div>
              {operationScreenshots.length > 0 && (
                <div className="mt-2">
                  <label className="text-xs font-medium text-text-secondary mb-1 block">Screenshots</label>
                  <div className="grid grid-cols-4 gap-2">
                    {operationScreenshots.map((screenshot) => (
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
          </>
        )}
      </Card>

      {/* Comments */}
      {isExpanded && (
        <div className="border-t border-border pt-4">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Comments</h3>
          <CommentThread
            entityType="operation"
            entityId={operation._id.toString()}
            currentUserId={currentUserId}
          />
        </div>
      )}

      {/* Asset Form Modal */}
      <Modal
        isOpen={showAssetForm}
        title="Add Asset"
        onClose={() => setShowAssetForm(false)}
      >
        <AssetForm
          linkedOperationId={operation._id.toString()}
          projects={projects}
          operations={operations}
          onSubmit={async (data) => {
            try {
              const submitData: any = {
                ...data,
                linkedOperationId: operation._id.toString(),
              };

              let response;
              if (data.file) {
                const formData = new FormData();
                formData.append('file', data.file);
                formData.append('name', submitData.name);
                formData.append('type', submitData.type);
                if (submitData.description) formData.append('description', submitData.description);
                if (submitData.category) formData.append('category', submitData.category);
                if (submitData.tags) formData.append('tags', JSON.stringify(submitData.tags));
                if (submitData.url) formData.append('url', submitData.url);
                if (submitData.textContent) formData.append('textContent', submitData.textContent);
                formData.append('linkedOperationId', submitData.linkedOperationId);

                response = await fetch('/api/assets/upload', {
                  method: 'POST',
                  body: formData,
                });
              } else {
                const { file, ...jsonData } = submitData;
                response = await fetch('/api/assets', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(jsonData),
                });
              }

              if (response.ok) {
                setShowAssetForm(false);
                // Refresh assets
                const assetsRes = await fetch(`/api/assets?linkedOperationId=${operation._id}`);
                if (assetsRes.ok) {
                  const assetsData = await assetsRes.json();
                  const assets = assetsData.filter((asset: IAsset) => 
                    asset.linkedOperationId?.toString() === operation._id.toString() &&
                    asset.type !== 'screenshot'
                  );
                  const screenshots = assetsData.filter((asset: IAsset) => 
                    asset.linkedOperationId?.toString() === operation._id.toString() &&
                    asset.type === 'screenshot'
                  );
                  setOperationAssets(assets);
                  setOperationScreenshots(screenshots);
                }
              } else {
                const error = await response.json();
                alert(error.error || 'Failed to create asset');
              }
            } catch (error) {
              console.error('Error creating asset:', error);
              alert('Failed to create asset');
            }
          }}
          onCancel={() => setShowAssetForm(false)}
        />
      </Modal>
    </div>
  );
}
