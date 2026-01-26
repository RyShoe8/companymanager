'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { IOperation } from '@/lib/models/Operation';
import { IEmployee } from '@/lib/models/Employee';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatDate } from '@/lib/utils/dateUtils';

export default function RunDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<IProject | null>(null);
  const [operations, setOperations] = useState<IOperation[]>([]);
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
      const [projectRes, operationsRes, employeesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch('/api/operations'),
        fetch('/api/employees'),
      ]);

      if (projectRes.status === 401 || operationsRes.status === 401 || employeesRes.status === 401) {
        router.push('/login');
        return;
      }

      if (!projectRes.ok) {
        router.push('/run');
        return;
      }

      const projectData = await projectRes.json();
      const operationsData = await operationsRes.json();
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

      // Filter operations for this project
      const projectOperations = operationsData.filter((op: IOperation) => 
        op.projectId?.toString() === projectId
      );

      setProject(projectData);
      setOperations(projectOperations);
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

  const handleOperationReview = async (operationId: string, approved: boolean) => {
    try {
      const response = await fetch(`/api/operations/${operationId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      // Error reviewing operation
    }
  };

  const submitOperationForReview = async (operationId: string) => {
    try {
      const response = await fetch(`/api/operations/${operationId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      // Error submitting for review
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

  const activeOperations = operations.filter(op => op.status === 'active' || op.status === 'in-review');
  const completedOperations = operations.filter(op => op.status === 'completed');
  const operationsNeedingReview = operations.filter(op => op.status === 'in-review');

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

        {/* Review Requests */}
        {operationsNeedingReview.length > 0 && isManagerOrAdmin && (
          <Card className="p-4 mb-6 border-yellow-200 bg-yellow-50">
            <h3 className="font-semibold text-gray-900 mb-3">Operations Pending Review</h3>
            <div className="space-y-2">
              {operationsNeedingReview.map((operation) => (
                <div key={operation._id.toString()} className="flex items-center justify-between p-3 bg-white rounded">
                  <span className="text-sm">{operation.name}</span>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => handleOperationReview(operation._id.toString(), false)}
                    >
                      Decline
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleOperationReview(operation._id.toString(), true)}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Active Operations */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Operations</h2>
          {activeOperations.length === 0 ? (
            <p className="text-gray-500 text-sm">No active operations</p>
          ) : (
            <div className="space-y-3">
              {activeOperations.map((operation) => {
                const isAssignedToMe = 
                  operation.assignedToEmployeeId?.toString() === currentUserEmployeeId ||
                  operation.assignedTo === employees.find(e => e._id.toString() === currentUserEmployeeId)?.name;
                const canSubmitForReview = isAssignedToMe && operation.status === 'active';
                
                return (
                  <div key={operation._id.toString()} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{operation.name}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        operation.status === 'in-review' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {operation.status === 'in-review' ? 'In Review' : 'Active'}
                      </span>
                    </div>
                    {operation.description && (
                      <p className="text-sm text-gray-600 mb-2">{operation.description}</p>
                    )}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      {operation.startDate && operation.endDate && (
                        <span>
                          {formatDate(operation.startDate)} - {formatDate(operation.endDate)}
                        </span>
                      )}
                      {canSubmitForReview && (
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => submitOperationForReview(operation._id.toString())}
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

        {/* Completed Operations */}
        {completedOperations.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Completed Operations</h2>
            <div className="space-y-2">
              {completedOperations.map((operation) => (
                <div key={operation._id.toString()} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 line-through">{operation.name}</span>
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
