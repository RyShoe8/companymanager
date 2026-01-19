'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IProject, TimeframeType, ProjectStatus, IProjectStage } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

interface ProjectFormProps {
  project?: IProject;
  timeframeType: TimeframeType;
  onSubmit: (data: Partial<IProject>) => void;
  onCancel: () => void;
  userRole?: 'Administrator' | 'Manager' | 'User';
}

export default function ProjectForm({ project, timeframeType, onSubmit, onCancel, userRole }: ProjectFormProps) {
  const router = useRouter();
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  // Support both legacy url and new urls array
  const [urls, setUrls] = useState<string[]>(
    project?.urls && project.urls.length > 0 
      ? project.urls 
      : project?.url 
        ? [project.url] 
        : []
  );
  const [startDate, setStartDate] = useState(
    project?.startDate ? new Date(project.startDate).toISOString().split('T')[0] : ''
  );
  const [endDate, setEndDate] = useState(
    project?.endDate ? new Date(project.endDate).toISOString().split('T')[0] : ''
  );
  const [color, setColor] = useState(project?.color || '#3b82f6');
  const [status, setStatus] = useState<ProjectStatus>(project?.status || 'planning');
  const [estimatedHours, setEstimatedHours] = useState(project?.estimatedHours?.toString() || '');
  const [assignedTo, setAssignedTo] = useState(project?.assignedTo || '');
  const [stages, setStages] = useState<IProjectStage[]>(project?.stages || []);
  const [showStages, setShowStages] = useState(false);
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const isManagerOrAdmin = userRole === 'Administrator' || userRole === 'Manager';
  const isRegularUser = userRole === 'User';

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

  }, []);

  useEffect(() => {
    if (!project) {
      // Set default dates based on timeframe
      const today = new Date();
      const start = new Date(today);
      const end = new Date(today);
      
      switch (timeframeType) {
        case 'weekly':
          end.setDate(today.getDate() + 7);
          break;
        case 'monthly':
          end.setMonth(today.getMonth() + 1);
          break;
        case 'quarterly':
          end.setMonth(today.getMonth() + 3);
          break;
        case 'yearly':
          end.setFullYear(today.getFullYear() + 1);
          break;
      }
      
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [timeframeType, project]);

  const addStage = () => {
    const newStage: IProjectStage = {
      name: '',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'planning' as ProjectStatus,
    };
    setStages([...stages, newStage]);
  };

  const removeStage = (index: number) => {
    setStages(stages.filter((_, i) => i !== index));
  };

  const updateStage = (index: number, field: keyof IProjectStage, value: any) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], [field]: value };
    setStages(updated);
  };

  const addUrl = () => {
    setUrls([...urls, '']);
  };

  const removeUrl = (index: number) => {
    setUrls(urls.filter((_, i) => i !== index));
  };

  const updateUrl = (index: number, value: string) => {
    const updated = [...urls];
    updated[index] = value;
    setUrls(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData: Partial<IProject> = {
      name,
      description,
      urls: urls.filter(url => url.trim() !== ''),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      timeframeType,
      color,
      status,
    };

    if (estimatedHours) {
      submitData.estimatedHours = parseFloat(estimatedHours);
    }

    if (assignedTo) {
      submitData.assignedTo = assignedTo;
    }

    if (stages.length > 0) {
      submitData.stages = stages.map(stage => ({
        ...stage,
        startDate: new Date(stage.startDate),
        endDate: new Date(stage.endDate),
      }));
    }

    onSubmit(submitData);
  };

  const colorOptions = [
    { value: '#3b82f6', label: 'Blue' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#84cc16', label: 'Lime' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto">
      <Input
        label="Project Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        disabled={isRegularUser}
      />
      <Input
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={isRegularUser}
      />
      {/* URLs Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            URLs (optional)
          </label>
          {!isRegularUser && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addUrl}
            >
              + Add URL
            </Button>
          )}
        </div>
        {urls.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            No URLs added. Click "Add URL" to add one.
          </p>
        )}
        {urls.map((url, index) => (
          <div key={index} className="flex gap-2 mb-2">
            <Input
              type="url"
              value={url}
              onChange={(e) => updateUrl(index, e.target.value)}
              placeholder="https://example.com"
              disabled={isRegularUser}
              className="flex-1"
            />
            {!isRegularUser && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => removeUrl(index)}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Start Date or Single Date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
          disabled={isRegularUser}
        />
        <Input
          label="End Date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
          disabled={isRegularUser}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Estimated Hours (optional)"
          type="number"
          min="0"
          step="0.5"
          value={estimatedHours}
          onChange={(e) => setEstimatedHours(e.target.value)}
          placeholder="e.g., 40"
          disabled={isRegularUser}
        />
        <Select
          label="Assigned To (optional)"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          disabled={isRegularUser}
          options={[
            { value: '', label: 'None' },
            ...employees.map(emp => ({ value: emp.name, label: emp.name }))
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          disabled={isRegularUser}
          options={colorOptions}
        />
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus)}
          disabled={isRegularUser && project?.status !== 'in-development'}
          options={
            isRegularUser && project?.status === 'in-development'
              ? [
                  { value: 'in-development', label: 'In Development' },
                  { value: 'in-review', label: 'In Review' },
                ]
              : [
                  { value: 'planning', label: 'Planning' },
                  { value: 'in-development', label: 'In Development' },
                  { value: 'in-review', label: 'In Review' },
                  { value: 'launched', label: 'Launched' },
                ]
          }
        />
      </div>

      {/* Stages Section - Only for admins/managers */}
      {isManagerOrAdmin && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Stages (optional)
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowStages(!showStages)}
              >
                {showStages ? 'Hide' : 'Show'} Stages
              </Button>
              {showStages && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addStage}
                >
                  + Add Stage
                </Button>
              )}
            </div>
          </div>

        {showStages && stages.length > 0 && (
          <div className="space-y-3">
            {stages.map((stage, index) => (
              <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900 dark:text-white">Stage {index + 1}</h4>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => removeStage(index)}
                  >
                    Remove
                  </Button>
                </div>
                <Input
                  label="Stage Name"
                  value={stage.name}
                  onChange={(e) => updateStage(index, 'name', e.target.value)}
                  required
                />
                <Input
                  label="Description (optional)"
                  value={stage.description || ''}
                  onChange={(e) => updateStage(index, 'description', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Start Date"
                    type="date"
                    value={stage.startDate ? new Date(stage.startDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => updateStage(index, 'startDate', new Date(e.target.value))}
                    required
                  />
                  <Input
                    label="End Date"
                    type="date"
                    value={stage.endDate ? new Date(stage.endDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => updateStage(index, 'endDate', new Date(e.target.value))}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Estimated Hours (optional)"
                    type="number"
                    min="0"
                    step="0.5"
                    value={stage.estimatedHours?.toString() || ''}
                    onChange={(e) => updateStage(index, 'estimatedHours', e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                  <Select
                    label="Assigned To (optional)"
                    value={stage.assignedTo || ''}
                    onChange={(e) => updateStage(index, 'assignedTo', e.target.value)}
                    options={[
                      { value: '', label: 'None' },
                      ...employees.map(emp => ({ value: emp.name, label: emp.name }))
                    ]}
                  />
                </div>
                <Select
                  label="Status"
                  value={stage.status || 'planning'}
                  onChange={(e) => updateStage(index, 'status', e.target.value as ProjectStatus)}
                  options={[
                    { value: 'planning', label: 'Planning' },
                    { value: 'in-development', label: 'In Development' },
                    { value: 'in-review', label: 'In Review' },
                    { value: 'launched', label: 'Launched' },
                  ]}
                />
              </div>
            ))}
          </div>
        )}

          {showStages && stages.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No stages added. Click "Add Stage" to create project phases.
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
        {project && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              router.push(`/assets?projectId=${project._id}`);
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
            {project ? 'Update' : 'Create'} Project
          </Button>
        </div>
      </div>
    </form>
  );
}
