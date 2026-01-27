'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IProject, ProjectStatus, ProjectType, TaskStatus, IProjectTask } from '@/lib/models/Project';
import { IOperation, RecurrenceType, OperationStatus } from '@/lib/models/Operation';
import { IEmployee } from '@/lib/models/Employee';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import MultiSelect from '@/components/ui/MultiSelect';
import Button from '@/components/ui/Button';
import { Types } from 'mongoose';

interface ProjectFormProps {
  project?: IProject;
  onSubmit: (data: Partial<IProject>) => void;
  onCancel: () => void;
  userRole?: 'Administrator' | 'Manager' | 'User';
}

export default function ProjectForm({ project, onSubmit, onCancel, userRole }: ProjectFormProps) {
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
  const [projectType, setProjectType] = useState<ProjectType>(project?.projectType || 'generic');
  const [color, setColor] = useState(project?.color || '#3b82f6');
  const [status, setStatus] = useState<ProjectStatus>(project?.status || 'planning');
  const [endDate, setEndDate] = useState(
    project?.endDate ? new Date(project.endDate).toISOString().split('T')[0] : ''
  );
  const [estimatedHours, setEstimatedHours] = useState(project?.estimatedHours?.toString() || '');
  const [assignedTo, setAssignedTo] = useState(project?.assignedTo || '');
  const [assignedToEmployeeId, setAssignedToEmployeeId] = useState(
    project?.assignedToEmployeeId?.toString() || ''
  );
  const [assignedToEmployeeIds, setAssignedToEmployeeIds] = useState<string[]>(
    project?.assignedToEmployeeIds?.map(id => id.toString()) || 
    (project?.assignedToEmployeeId ? [project.assignedToEmployeeId.toString()] : [])
  );
  const [assignedToNames, setAssignedToNames] = useState<string[]>(
    project?.assignedToNames || 
    (project?.assignedTo ? [project.assignedTo] : [])
  );
  const [tasks, setTasks] = useState<IProjectTask[]>(project?.tasks || []);
  const [operations, setOperations] = useState<IOperation[]>([]);
  const [showTasks, setShowTasks] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [operationLocalState, setOperationLocalState] = useState<Record<string, { name: string; description: string; estimatedHours?: string }>>({});
  const isManagerOrAdmin = userRole === 'Administrator' || userRole === 'Manager';
  const isRegularUser = userRole === 'User';
  const isLaunched = project?.status === 'launched';

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
        // Error fetching employees
      }
    };
    fetchEmployees();

    // If project is launched, fetch operations linked to this project
    if (isLaunched && project?._id) {
      const fetchOperations = async () => {
        try {
          const response = await fetch('/api/operations');
          if (response.ok) {
            const data = await response.json();
            const projectOperations = data.filter((op: IOperation) => 
              op.projectId?.toString() === project._id.toString()
            );
            setOperations(projectOperations);
          }
        } catch (error) {
          // Error fetching operations
        }
      };
      fetchOperations();
    }
  }, [isLaunched, project?._id]);


  const addTask = () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 7); // Default to 7 days from now
    const newTask: IProjectTask = {
      name: '',
      startDate: today,
      endDate: endDate,
      status: 'active' as TaskStatus,
    };
    setTasks([...tasks, newTask]);
  };

  const removeTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const deleteTask = async (index: number) => {
    if (!project?._id) {
      // If no project ID (new project), just remove from local state
      removeTask(index);
      return;
    }
    
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }
    
    const updatedTasks = tasks.filter((_, i) => i !== index);
    try {
      const response = await fetch(`/api/projects/${project._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: updatedTasks }),
      });
      if (response.ok) {
        setTasks(updatedTasks);
        // Refresh the form data
        const updatedProject = await response.json();
        if (updatedProject.tasks) {
          setTasks(updatedProject.tasks);
        }
      } else {
        const errorData = await response.json();
        // Failed to delete task
        alert('Failed to delete task. Please try again.');
      }
    } catch (error) {
      // Error deleting task
      alert('Error deleting task. Please try again.');
    }
  };

  const addOperation = async () => {
    if (!project?._id) {
      alert('Cannot add operation: Project must be saved first.');
      return;
    }

    try {
      const newOperationData = {
        name: 'New Operation',
        description: '',
        recurrenceType: 'none',
        status: 'active',
        projectId: project._id.toString(),
      };

      const response = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOperationData),
      });

      if (response.ok) {
        const newOperation = await response.json();
        // Refresh operations from server
        const opsResponse = await fetch('/api/operations');
        if (opsResponse.ok) {
          const data = await opsResponse.json();
          const projectOperations = data.filter((op: IOperation) => 
            op.projectId?.toString() === project._id.toString()
          );
          setOperations(projectOperations);
          // Ensure operations section is visible after adding
          if (!showOperations) {
            setShowOperations(true);
          }
        }
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to create operation. Please try again.';
        alert(errorMessage);
      }
    } catch (error) {
      // Error creating operation
      alert('Error creating operation. Please try again.');
    }
  };

  const deleteOperation = async (operationId: string) => {
    if (!confirm('Are you sure you want to delete this operation? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/operations/${operationId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        // Remove from local state immediately
        setOperations(operations.filter(op => op._id?.toString() !== operationId));
        // Refresh operations from server
        const opsResponse = await fetch('/api/operations');
        if (opsResponse.ok) {
          const data = await opsResponse.json();
          const projectOperations = data.filter((op: IOperation) => 
            op.projectId?.toString() === project?._id.toString()
          );
          setOperations(projectOperations);
        }
      } else {
        const errorData = await response.json();
        // Failed to delete operation
        alert('Failed to delete operation. Please try again.');
        // Reload operations to restore state
        const opsResponse = await fetch('/api/operations');
        if (opsResponse.ok) {
          const data = await opsResponse.json();
          const projectOperations = data.filter((op: IOperation) => 
            op.projectId?.toString() === project?._id.toString()
          );
          setOperations(projectOperations);
        }
      }
    } catch (error) {
      // Error deleting operation
      alert('Error deleting operation. Please try again.');
    }
  };

  const debounceTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  const updateOperationLocalState = useCallback((operationId: string, field: 'name' | 'description', value: string) => {
    setOperationLocalState(prev => {
      const currentOperation = operations.find(op => op._id?.toString() === operationId);
      return {
        ...prev,
        [operationId]: {
          name: prev[operationId]?.name ?? currentOperation?.name ?? '',
          description: prev[operationId]?.description ?? currentOperation?.description ?? '',
          [field]: value,
        }
      };
    });
  }, [operations]);

  const performOperationUpdate = useCallback(async (operationId: string, updates: Partial<IOperation>) => {
    try {
      // If updating assignedTo by name, convert to employeeId
      const updateData: any = { ...updates };
      if (updates.assignedTo && typeof updates.assignedTo === 'string') {
        const selectedEmployee = employees.find(emp => emp.name === updates.assignedTo);
        if (selectedEmployee) {
          updateData.assignedToEmployeeId = selectedEmployee._id.toString();
        }
      }
      // Convert assignedToEmployeeId string to ObjectId if present
      if (updateData.assignedToEmployeeId && typeof updateData.assignedToEmployeeId === 'string') {
        updateData.assignedToEmployeeId = new Types.ObjectId(updateData.assignedToEmployeeId);
      }
      
      const response = await fetch(`/api/operations/${operationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (response.ok) {
        const updated = await response.json();
        setOperations(prev => prev.map(op => 
          op._id?.toString() === operationId ? updated : op
        ));
        // Clear local state after successful update
        setOperationLocalState(prev => {
          const newState = { ...prev };
          delete newState[operationId];
          return newState;
        });
      }
    } catch (error) {
      // Error updating operation
    }
  }, [employees]);

  const updateOperation = useCallback(async (operationId: string, updates: Partial<IOperation>, debounce: boolean = false) => {
    // Update local state immediately for name and description to ensure responsive UI
    if (updates.name !== undefined) {
      updateOperationLocalState(operationId, 'name', updates.name);
    }
    if (updates.description !== undefined) {
      updateOperationLocalState(operationId, 'description', updates.description || '');
    }

    // Clear existing timeout for this operation
    if (debounceTimeouts.current[operationId]) {
      clearTimeout(debounceTimeouts.current[operationId]);
    }

    // If debouncing, use setTimeout to delay the API call
    if (debounce) {
      debounceTimeouts.current[operationId] = setTimeout(() => {
        performOperationUpdate(operationId, updates);
        delete debounceTimeouts.current[operationId];
      }, 500);
    } else {
      // Clear any pending debounced call
      if (debounceTimeouts.current[operationId]) {
        clearTimeout(debounceTimeouts.current[operationId]);
        delete debounceTimeouts.current[operationId];
      }
      await performOperationUpdate(operationId, updates);
    }
  }, [performOperationUpdate, updateOperationLocalState]);

  // Optimize operation updates by updating local state immediately for better UX
  const updateOperationOptimized = useCallback(async (operationId: string, updates: Partial<IOperation>, debounce: boolean = false) => {
    // For non-text fields, update local operations state immediately for instant feedback
    if (!debounce && (updates.startDate !== undefined || updates.endDate !== undefined || 
        updates.estimatedHours !== undefined || updates.recurrenceType !== undefined || 
        updates.status !== undefined || updates.assignedTo !== undefined || updates.assignedToEmployeeId !== undefined)) {
      setOperations(prev => prev.map(op => {
        if (op._id?.toString() === operationId) {
          // Create a new object with updates, maintaining the operation structure
          // Use type assertion since we're merging partial updates with the full operation
          return { ...op, ...updates } as IOperation;
        }
        return op;
      }));
    }
    
    // Then call the actual update function
    await updateOperation(operationId, updates, debounce);
  }, [updateOperation]);

  const updateTask = useCallback((index: number, field: keyof IProjectTask, value: any) => {
    setTasks(prevTasks => {
      const updated = [...prevTasks];
      const task = updated[index];
      
      // Handle employee assignment for tasks - prefer employeeId over name
      if (field === 'assignedTo' && typeof value === 'string') {
        const selectedEmployee = employees.find(emp => emp.name === value);
        if (selectedEmployee) {
          (task as any).assignedToEmployeeId = selectedEmployee._id.toString();
          (task as any).assignedTo = selectedEmployee.name;
        } else {
          (task as any).assignedTo = value;
          (task as any).assignedToEmployeeId = undefined;
        }
      } else {
        updated[index] = { ...task, [field]: value };
      }
      
      return updated;
    });
  }, [employees]);

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
      projectType,
      color,
      status,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    if (estimatedHours) {
      submitData.estimatedHours = parseFloat(estimatedHours);
    }

    // Handle multiple assignments (preferred)
    if (assignedToEmployeeIds && assignedToEmployeeIds.length > 0) {
      submitData.assignedToEmployeeIds = assignedToEmployeeIds.map(id => new Types.ObjectId(id));
      submitData.assignedToNames = assignedToNames.filter(name => name).length > 0 ? assignedToNames : undefined;
      // Keep legacy fields for backward compatibility (use first assignment)
      submitData.assignedToEmployeeId = new Types.ObjectId(assignedToEmployeeIds[0]);
      submitData.assignedTo = assignedToNames[0] || employees.find(e => e._id.toString() === assignedToEmployeeIds[0])?.name;
    } else if (assignedToEmployeeId) {
      // Legacy single assignment support
      submitData.assignedToEmployeeId = new Types.ObjectId(assignedToEmployeeId);
      submitData.assignedTo = assignedTo;
    } else if (assignedTo) {
      submitData.assignedTo = assignedTo;
    }

    if (tasks.length > 0) {
      submitData.tasks = tasks.map(task => ({
        ...task,
        startDate: new Date(task.startDate),
        endDate: new Date(task.endDate),
        // Ensure employeeId is included if available
        assignedToEmployeeId: (task as any).assignedToEmployeeId || undefined,
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

      {/* Project Type - Required at creation */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Project Type {!project && <span className="text-red-500">*</span>}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { value: 'website', label: 'Website', icon: '🌐', desc: 'Web presence' },
            { value: 'store', label: 'Store', icon: '🛒', desc: 'E-commerce' },
            { value: 'app', label: 'App', icon: '📱', desc: 'Application' },
            { value: 'generic', label: 'Generic', icon: '📁', desc: 'Other' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => !isRegularUser && setProjectType(option.value as ProjectType)}
              disabled={isRegularUser}
              className={`p-3 rounded-lg border-2 transition-all text-center ${
                projectType === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              } ${isRegularUser ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="text-2xl block mb-1">{option.icon}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white block">{option.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{option.desc}</span>
            </button>
          ))}
        </div>
      </div>

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
        <Select
          label="Project Type"
          value={projectType}
          onChange={(e) => setProjectType(e.target.value as ProjectType)}
          disabled={isRegularUser}
          options={[
            { value: 'internal', label: 'Internal' },
            { value: 'client', label: 'Client' },
          ]}
        />
        <Input
          label="Estimated Hours (optional)"
          type="number"
          min="0"
          step="0.01"
          value={estimatedHours}
          onChange={(e) => setEstimatedHours(e.target.value)}
          placeholder="e.g., 40 or 0.25"
          disabled={isRegularUser}
        />
      </div>
      <MultiSelect
        label="Assigned To (optional)"
        value={assignedToEmployeeIds}
        onChange={(selectedIds) => {
          setAssignedToEmployeeIds(selectedIds);
          const selectedEmployees = employees.filter(emp => selectedIds.includes(emp._id.toString()));
          setAssignedToNames(selectedEmployees.map(emp => emp.name));
          // Update legacy fields for backward compatibility
          if (selectedIds.length > 0) {
            setAssignedToEmployeeId(selectedIds[0]);
            setAssignedTo(selectedEmployees[0]?.name || '');
          } else {
            setAssignedToEmployeeId('');
            setAssignedTo('');
          }
        }}
        disabled={isRegularUser}
        options={employees.map(emp => ({ 
          value: emp._id.toString(), 
          label: emp.name 
        }))}
      />
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
                  { value: 'completed', label: 'Completed' },
                ]
          }
        />
      </div>
      <Input
        label="End Date (optional) - Project stops appearing on status page after this date"
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        disabled={isRegularUser}
        placeholder="No end date"
      />

      {/* Operations Section for Launched Projects - Only for admins/managers */}
      {isManagerOrAdmin && isLaunched && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Operations
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowOperations(!showOperations)}
              >
                {showOperations ? 'Hide' : 'Show'} Operations
              </Button>
              {showOperations && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addOperation}
                >
                  + Add Operation
                </Button>
              )}
            </div>
          </div>

          {showOperations && operations.length > 0 && (
            <div className="space-y-3">
              {operations.map((operation) => (
                <div key={operation._id?.toString()} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 dark:text-white">Operation</h4>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => operation._id && deleteOperation(operation._id.toString())}
                    >
                      Delete
                    </Button>
                  </div>
                  <Input
                    label="Operation Name"
                    value={operationLocalState[operation._id?.toString() || '']?.name ?? operation.name}
                    onChange={(e) => operation._id && updateOperation(operation._id.toString(), { name: e.target.value }, true)}
                    onBlur={(e) => operation._id && updateOperation(operation._id.toString(), { name: e.target.value }, false)}
                    required
                  />
                  <Input
                    label="Description (optional)"
                    value={operationLocalState[operation._id?.toString() || '']?.description ?? (operation.description || '')}
                    onChange={(e) => operation._id && updateOperation(operation._id.toString(), { description: e.target.value || undefined }, true)}
                    onBlur={(e) => operation._id && updateOperation(operation._id.toString(), { description: e.target.value || undefined }, false)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Start Date"
                      type="date"
                      value={operation.startDate ? new Date(operation.startDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => operation._id && updateOperationOptimized(operation._id.toString(), { startDate: e.target.value ? new Date(e.target.value) : undefined }, false)}
                    />
                    <Input
                      label="End Date"
                      type="date"
                      value={operation.endDate ? new Date(operation.endDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => operation._id && updateOperationOptimized(operation._id.toString(), { endDate: e.target.value ? new Date(e.target.value) : undefined }, false)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Estimated Hours (optional)"
                      type="number"
                      min="0"
                      step="0.01"
                      value={operationLocalState[operation._id?.toString() || '']?.estimatedHours ?? (operation.estimatedHours?.toString() || '')}
                      onChange={(e) => {
                        const opId = operation._id?.toString();
                        if (opId) {
                          setOperationLocalState(prev => ({
                            ...prev,
                            [opId]: {
                              ...prev[opId],
                              name: prev[opId]?.name ?? operation.name,
                              description: prev[opId]?.description ?? (operation.description || ''),
                              estimatedHours: e.target.value
                            }
                          }));
                        }
                      }}
                      onBlur={(e) => {
                        const opId = operation._id?.toString();
                        if (opId) {
                          const value = e.target.value.trim();
                          const numValue = value ? parseFloat(value) : undefined;
                          updateOperationOptimized(opId, { estimatedHours: numValue }, false);
                        }
                      }}
                      placeholder="e.g., 0.25 or 0.01"
                    />
                    <Select
                      label="Recurrence"
                      value={operation.recurrenceType || 'none'}
                      onChange={(e) => operation._id && updateOperationOptimized(operation._id.toString(), { recurrenceType: e.target.value as RecurrenceType }, false)}
                      options={[
                        { value: 'none', label: 'None' },
                        { value: 'weekly', label: 'Weekly' },
                        { value: 'bi-weekly', label: 'Bi-weekly' },
                        { value: 'monthly', label: 'Monthly' },
                      ]}
                    />
                  </div>
                  <Select
                    label="Status"
                    value={operation.status || 'active'}
                    onChange={(e) => operation._id && updateOperationOptimized(operation._id.toString(), { status: e.target.value as OperationStatus }, false)}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'in-review', label: 'In Review' },
                      { value: 'completed', label: 'Completed' },
                    ]}
                  />
                  <Select
                    label="Assigned To (optional)"
                    value={(operation as any).assignedToEmployeeId?.toString() || operation.assignedTo || ''}
                    onChange={(e) => {
                      if (operation._id) {
                        const selectedEmployee = employees.find(emp => emp._id.toString() === e.target.value);
                        if (selectedEmployee) {
                          updateOperationOptimized(operation._id.toString(), { 
                            assignedToEmployeeId: selectedEmployee._id.toString() as any,
                            assignedTo: selectedEmployee.name 
                          }, false);
                        } else {
                          updateOperationOptimized(operation._id.toString(), { 
                            assignedTo: e.target.value || undefined 
                          }, false);
                        }
                      }
                    }}
                    options={[
                      { value: '', label: 'None' },
                      ...employees.map(emp => ({ 
                        value: emp._id.toString(), 
                        label: emp.name 
                      }))
                    ]}
                  />
                </div>
              ))}
            </div>
          )}

          {showOperations && operations.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No operations found. Operations are created automatically when a project is launched.
            </p>
          )}
        </div>
      )}

      {/* Tasks Section - Only for admins/managers and non-launched projects */}
      {isManagerOrAdmin && !isLaunched && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tasks (optional)
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowTasks(!showTasks)}
              >
                {showTasks ? 'Hide' : 'Show'} Tasks
              </Button>
              {showTasks && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addTask}
                >
                  + Add Task
                </Button>
              )}
            </div>
          </div>

        {showTasks && tasks.length > 0 && (
          <div className="space-y-3">
            {tasks.map((task, index) => (
              <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2 bg-white dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900 dark:text-white">Task {index + 1}</h4>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => project?._id ? deleteTask(index) : removeTask(index)}
                  >
                    Delete
                  </Button>
                </div>
                <Input
                  label="Task Name"
                  value={task.name}
                  onChange={(e) => updateTask(index, 'name', e.target.value)}
                  required
                />
                <Input
                  label="Description (optional)"
                  value={task.description || ''}
                  onChange={(e) => updateTask(index, 'description', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Start Date"
                    type="date"
                    value={task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => updateTask(index, 'startDate', new Date(e.target.value))}
                    required
                  />
                  <Input
                    label="End Date"
                    type="date"
                    value={task.endDate ? new Date(task.endDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => updateTask(index, 'endDate', new Date(e.target.value))}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Estimated Hours (optional)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={task.estimatedHours?.toString() || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty string while typing, parse on blur
                      if (value === '') {
                        updateTask(index, 'estimatedHours', undefined);
                      } else {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                          updateTask(index, 'estimatedHours', numValue);
                        }
                      }
                    }}
                    placeholder="e.g., 0.25 or 0.01"
                  />
                  <Select
                    label="Assigned To (optional)"
                    value={(task as any).assignedToEmployeeId?.toString() || task.assignedTo || ''}
                    onChange={(e) => {
                      const selectedEmployee = employees.find(emp => emp._id.toString() === e.target.value);
                      if (selectedEmployee) {
                        updateTask(index, 'assignedTo', selectedEmployee.name);
                        const updated = [...tasks];
                        (updated[index] as any).assignedToEmployeeId = selectedEmployee._id.toString();
                        setTasks(updated);
                      } else {
                        updateTask(index, 'assignedTo', e.target.value);
                      }
                    }}
                    options={[
                      { value: '', label: 'None' },
                      ...employees.map(emp => ({ 
                        value: emp._id.toString(), 
                        label: emp.name 
                      }))
                    ]}
                  />
                </div>
                  <Select
                    label="Status"
                    value={task.status || 'active'}
                    onChange={(e) => updateTask(index, 'status', e.target.value as TaskStatus)}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'in-review', label: 'In Review' },
                      { value: 'completed', label: 'Completed' },
                    ]}
                  />
              </div>
            ))}
          </div>
        )}

          {showTasks && tasks.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No tasks added. Click "Add Task" to create project phases.
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
