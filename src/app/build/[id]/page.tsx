'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatDate } from '@/lib/utils/dateUtils';

export default function BuildDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<IProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<'Administrator' | 'Manager' | 'User' | undefined>();
  const [isManagerOrAdmin, setIsManagerOrAdmin] = useState(false);
  const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<IEmployee[]>([]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectRes, employeesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch('/api/employees'),
      ]);

      if (projectRes.status === 401 || employeesRes.status === 401) {
        router.push('/login');
        return;
      }

      if (!projectRes.ok) {
        router.push('/build');
        return;
      }

      const projectData = await projectRes.json();
      const employeesData = await employeesRes.json();

      // Get current user's role
      try {
        const userResponse = await fetch('/api/auth/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData && userData.id) {
            const currentEmployee = employeesData.find((emp: IEmployee) => emp.userId?.toString() === userData.id);
            const role = currentEmployee?.role as 'Administrator' | 'Manager' | 'User' | undefined;
            setCurrentUserRole(role);
            setIsManagerOrAdmin(role === 'Manager' || role === 'Administrator');
            setCurrentUserEmployeeId(currentEmployee?._id?.toString() || null);
          }
        }
      } catch (error) {
        // Error loading current user
      }

      setProject(projectData);
      setEmployees(employeesData);
    } catch (error) {
      // Error loading data
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!project) return;
    
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const updatedProject = await response.json();
        setProject(updatedProject);
        // Redirect if moving to Run stage
        if (newStatus === 'launched') {
          router.push(`/run/${projectId}`);
        }
      }
    } catch (error) {
      // Error updating status
    }
  };

  const handleTaskReview = async (taskIndex: number, approved: boolean) => {
    if (!project) return;

    try {
      const response = await fetch(`/api/tasks/${taskIndex}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          taskIndex,
          approved,
        }),
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      // Error reviewing task
    }
  };

  const submitTaskForReview = async (taskIndex: number) => {
    if (!project) return;

    try {
      const response = await fetch(`/api/tasks/${taskIndex}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          taskIndex,
        }),
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      // Error submitting for review
    }
  };

  const getDefaultTaskDates = () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 7); // Default to 7 days from now
    return {
      startDate: today.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  };

  const addTask = async () => {
    if (!project) return;

    const defaultDates = getDefaultTaskDates();
    const newTask = {
      name: 'New Task',
      description: '',
      startDate: new Date(defaultDates.startDate),
      endDate: new Date(defaultDates.endDate),
      status: 'active' as const,
    };

    const updatedTasks = [...(project.tasks || []), newTask];

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: updatedTasks }),
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      // Error adding task
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Project not found</div>
      </div>
    );
  }

  const activeTasks = project.tasks?.filter(t => t.status === 'active' || t.status === 'in-review') || [];
  const completedTasks = project.tasks?.filter(t => t.status === 'completed') || [];
  const tasksNeedingReview = project.tasks?.filter(t => t.status === 'in-review') || [];

  return (
    <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="secondary" onClick={() => router.back()} className="mb-4">
            ← Back
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              {project.description && (
                <p className="text-gray-600 mt-2">{project.description}</p>
              )}
            </div>
            <div 
              className="w-6 h-6 rounded-full flex-shrink-0 ml-4"
              style={{ backgroundColor: project.color }}
            />
          </div>
        </div>

        {/* Status Actions */}
        {isManagerOrAdmin && (
          <Card className="p-4 mb-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Move to:</span>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => handleStatusChange('planning')}
              >
                Plan
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => handleStatusChange('launched')}
              >
                Run
              </Button>
            </div>
          </Card>
        )}

        {/* Review Requests */}
        {tasksNeedingReview.length > 0 && isManagerOrAdmin && (
          <Card className="p-4 mb-6 border-yellow-200 bg-yellow-50">
            <h3 className="font-semibold text-gray-900 mb-3">Tasks Pending Review</h3>
            <div className="space-y-2">
              {tasksNeedingReview.map((task, index) => {
                const taskIndex = project.tasks?.findIndex(t => t === task) ?? -1;
                if (taskIndex === -1) return null;
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-white rounded">
                    <span className="text-sm">{task.name}</span>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleTaskReview(taskIndex, false)}
                      >
                        Decline
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleTaskReview(taskIndex, true)}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Active Tasks */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Active Tasks</h2>
            {isManagerOrAdmin && (
              <Button size="sm" onClick={addTask}>
                + Add Task
              </Button>
            )}
          </div>
          {activeTasks.length === 0 ? (
            <p className="text-gray-500 text-sm">No active tasks</p>
          ) : (
            <div className="space-y-3">
              {activeTasks.map((task, index) => {
                const taskIndex = project.tasks?.findIndex(t => t === task) ?? -1;
                const isAssignedToMe = 
                  task.assignedToEmployeeId?.toString() === currentUserEmployeeId ||
                  task.assignedTo === employees.find(e => e._id.toString() === currentUserEmployeeId)?.name;
                const canSubmitForReview = isAssignedToMe && task.status === 'active';
                
                return (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{task.name}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        task.status === 'in-review' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {task.status === 'in-review' ? 'In Review' : 'Active'}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                    )}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>
                        {formatDate(task.startDate)} - {formatDate(task.endDate)}
                      </span>
                      {canSubmitForReview && (
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => submitTaskForReview(taskIndex)}
                        >
                          Submit for Review
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Completed Tasks</h2>
            <div className="space-y-2">
              {completedTasks.map((task, index) => (
                <div key={index} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 line-through">{task.name}</span>
                    <span className="text-xs text-gray-500">Completed</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
