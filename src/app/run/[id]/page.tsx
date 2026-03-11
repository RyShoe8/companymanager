'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatDate } from '@/lib/utils/dateUtils';

export default function RunDetailPage() {
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
        router.push('/run');
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
        // Redirect if moving to Build stage
        if (newStatus === 'in-development') {
          router.push(`/build/${projectId}`);
        }
      }
    } catch (error) {
      // Error updating status
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

  return (
    <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="secondary" onClick={() => router.back()} className="mb-4">
            ? Back
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

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Details</h2>
          <p className="text-gray-600">The project is currently in the Run stage.</p>
        </Card>
      </div>
    </div>
  );
}
