'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function PlanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<IProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<'Administrator' | 'Manager' | 'User' | undefined>();
  const [isManagerOrAdmin, setIsManagerOrAdmin] = useState(false);
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
        router.push('/plan');
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
        // Redirect if moving to Build stage
        if (newStatus === 'in-development') {
          router.push(`/build/${projectId}`);
        }
      }
    } catch (error) {
      // Error updating status
    }
  };

  const getDefaultTaskDates = () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 7);
    return {
      startDate: today.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  };

  const addTask = async () => {
    if (!project) return;

    const defaultDates = getDefaultTaskDates();
    const newTask = {
      name: '',
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

  const tasks = project.tasks || [];

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
                onClick={() => handleStatusChange('in-development')}
              >
                Build
              </Button>
            </div>
          </Card>
        )}

        {/* Tasks */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Planning Tasks</h2>
            {isManagerOrAdmin && (
              <Button size="sm" onClick={addTask}>
                + Add Task
              </Button>
            )}
          </div>
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-sm">No tasks yet</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">{task.name}</h4>
                  {task.description && (
                    <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
