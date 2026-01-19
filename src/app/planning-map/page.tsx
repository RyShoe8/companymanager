'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { IOperation } from '@/lib/models/Operation';
import { IEmployee } from '@/lib/models/Employee';
import { TimeframeType, getTimeframeRange } from '@/lib/utils/dateUtils';
import TimeHorizonSelector from '@/components/planning-map/TimeHorizonSelector';
import CalendarView from '@/components/planning-map/CalendarView';
import EmployeeSidebar from '@/components/planning-map/EmployeeSidebar';
import ProjectForm from '@/components/planning-map/ProjectForm';
import OperationForm from '@/components/planning-map/OperationForm';
import ProjectDetailView from '@/components/planning-map/ProjectDetailView';
import OperationDetailView from '@/components/planning-map/OperationDetailView';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';

export default function PlanningMapPage() {
  const router = useRouter();
  const [timeframe, setTimeframe] = useState<TimeframeType>('today');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [projects, setProjects] = useState<IProject[]>([]);
  const [operations, setOperations] = useState<IOperation[]>([]);
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showOperationForm, setShowOperationForm] = useState(false);
  const [showProjectDetail, setShowProjectDetail] = useState(false);
  const [showOperationDetail, setShowOperationDetail] = useState(false);
  const [editingProject, setEditingProject] = useState<IProject | undefined>();
  const [editingOperation, setEditingOperation] = useState<IOperation | undefined>();
  const [viewingProject, setViewingProject] = useState<IProject | undefined>();
  const [viewingOperation, setViewingOperation] = useState<IOperation | undefined>();
  const [isManagerOrAdmin, setIsManagerOrAdmin] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<'Administrator' | 'Manager' | 'User' | undefined>();
  const [currentUserEmployeeName, setCurrentUserEmployeeName] = useState<string | null>(null);
  const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState<string | null>(null);
  const [showOnlyMyAssignments, setShowOnlyMyAssignments] = useState(false);

  useEffect(() => {
    loadData();
  }, [timeframe]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsRes, operationsRes, employeesRes] = await Promise.all([
        fetch('/api/projects'), // Always fetch all projects - calendar handles date filtering
        fetch('/api/operations'), // Fetch all operations - calendar handles recurrence and date filtering
        fetch('/api/employees'),
      ]);

      if (projectsRes.status === 401 || operationsRes.status === 401 || employeesRes.status === 401) {
        router.push('/login');
        return;
      }

      const projectsData = await projectsRes.json();
      const operationsData = await operationsRes.json();
      const employeesData = await employeesRes.json();

      // Get current user's role and employee name
      try {
        const userResponse = await fetch('/api/auth/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData && userData.id) {
            const currentEmployee = employeesData.find((emp: IEmployee) => emp.userId?.toString() === userData.id);
            if (currentEmployee) {
              const role = currentEmployee.role || 'User';
              setIsManagerOrAdmin(role === 'Manager' || role === 'Administrator');
              setCurrentUserRole(role as 'Administrator' | 'Manager' | 'User');
              setCurrentUserEmployeeName(currentEmployee.name || null);
              setCurrentUserEmployeeId(currentEmployee._id?.toString() || null);
            } else {
              // Employee record not found - default to User
              setCurrentUserRole('User');
              setIsManagerOrAdmin(false);
            }
          }
        }
      } catch (error) {
        // Error loading current user
      }

      // Pass all projects to CalendarView - it will handle date filtering based on its viewDate
      setProjects(projectsData);
      setOperations(operationsData);
      setEmployees(employeesData);
    } catch (error) {
      // Error loading data
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    setEditingProject(undefined);
    setShowProjectForm(true);
  };

  const handleViewProject = (project: IProject) => {
    setViewingProject(project);
    setShowProjectDetail(true);
  };

  const handleEditProject = (project: IProject) => {
    setEditingProject(project);
    setShowProjectForm(true);
    setShowProjectDetail(false);
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setShowProjectDetail(false);
        setViewingProject(undefined);
        loadData();
      }
    } catch (error) {
      // Error deleting project
    }
  };

  const handleSubmitProject = async (data: Partial<IProject>) => {
    try {
      const url = editingProject ? `/api/projects/${editingProject._id}` : '/api/projects';
      const method = editingProject ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setShowProjectForm(false);
        setShowProjectDetail(false);
        setEditingProject(undefined);
        setViewingProject(undefined);
        loadData();
      }
    } catch (error) {
      // Error saving project
    }
  };

  const handleCreateOperation = () => {
    setEditingOperation(undefined);
    setShowOperationForm(true);
  };

  const handleViewOperation = (operation: IOperation) => {
    setViewingOperation(operation);
    setShowOperationDetail(true);
  };

  const handleEditOperation = (operation: IOperation) => {
    setEditingOperation(operation);
    setShowOperationForm(true);
    setShowOperationDetail(false);
  };

  const handleDeleteOperation = async (id: string) => {
    try {
      const response = await fetch(`/api/operations/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setShowOperationDetail(false);
        setViewingOperation(undefined);
        loadData();
      }
    } catch (error) {
      // Error deleting operation
    }
  };

  const handleSubmitOperation = async (data: Partial<IOperation>) => {
    try {
      const url = editingOperation ? `/api/operations/${editingOperation._id}` : '/api/operations';
      const method = editingOperation ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setShowOperationForm(false);
        setShowOperationDetail(false);
        setEditingOperation(undefined);
        setViewingOperation(undefined);
        loadData();
      }
    } catch (error) {
      // Error saving operation
    }
  };

  // Filter projects and operations for CalendarView:
  // - Regular Users: Always see only their assignments
  // - Managers/Admins: Filter based on "Show only my assignments" toggle
  const filteredProjects = (() => {
    // If role not set yet, show all projects (safer default)
    if (!currentUserRole) {
      return projects;
    }
    // Regular users always see only their assignments
    if (currentUserRole === 'User' && (currentUserEmployeeName || currentUserEmployeeId)) {
      return projects.filter((project) => {
        // Check multiple assignments array (new preferred method)
        const projectAssignedToIds = (project as any).assignedToEmployeeIds;
        if (projectAssignedToIds && Array.isArray(projectAssignedToIds)) {
          if (projectAssignedToIds.some((id: any) => id?.toString() === currentUserEmployeeId)) {
            return true;
          }
        }
        const projectAssignedToNames = (project as any).assignedToNames;
        if (projectAssignedToNames && Array.isArray(projectAssignedToNames)) {
          if (projectAssignedToNames.includes(currentUserEmployeeName)) {
            return true;
          }
        }
        // Check single assignment (legacy)
        const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
        if (projectAssignedToId === currentUserEmployeeId || project.assignedTo === currentUserEmployeeName) return true;
        if (project.tasks && project.tasks.some(task => {
          const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
          return taskAssignedToId === currentUserEmployeeId || task.assignedTo === currentUserEmployeeName;
        })) return true;
        return false;
      });
    }
    // Managers/Admins: Filter based on toggle
    if (showOnlyMyAssignments && (currentUserEmployeeName || currentUserEmployeeId)) {
      return projects.filter((project) => {
        // Check multiple assignments array (new preferred method)
        const projectAssignedToIds = (project as any).assignedToEmployeeIds;
        if (projectAssignedToIds && Array.isArray(projectAssignedToIds)) {
          if (projectAssignedToIds.some((id: any) => id?.toString() === currentUserEmployeeId)) {
            return true;
          }
        }
        const projectAssignedToNames = (project as any).assignedToNames;
        if (projectAssignedToNames && Array.isArray(projectAssignedToNames)) {
          if (projectAssignedToNames.includes(currentUserEmployeeName)) {
            return true;
          }
        }
        // Check single assignment (legacy)
        const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
        if (projectAssignedToId === currentUserEmployeeId || project.assignedTo === currentUserEmployeeName) return true;
        if (project.tasks && project.tasks.some(task => {
          const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
          return taskAssignedToId === currentUserEmployeeId || task.assignedTo === currentUserEmployeeName;
        })) return true;
        return false;
      });
    }
    // Managers/Admins with toggle off: show all projects
    return projects;
  })();

  const filteredOperations = (() => {
    // If role not set yet, show all operations (safer default)
    if (!currentUserRole) {
      return operations;
    }
    // Regular users always see only their assignments
    if (currentUserRole === 'User' && (currentUserEmployeeName || currentUserEmployeeId)) {
      return operations.filter((operation) => {
        const opAssignedToId = (operation as any).assignedToEmployeeId?.toString();
        return opAssignedToId === currentUserEmployeeId || operation.assignedTo === currentUserEmployeeName;
      });
    }
    // Managers/Admins: Filter based on toggle
    if (showOnlyMyAssignments && (currentUserEmployeeName || currentUserEmployeeId)) {
      return operations.filter((operation) => {
        const opAssignedToId = (operation as any).assignedToEmployeeId?.toString();
        return opAssignedToId === currentUserEmployeeId || operation.assignedTo === currentUserEmployeeName;
      });
    }
    // Managers/Admins with toggle off: show all operations
    return operations;
  })();

  // For EmployeeSidebar: Regular users see only their projects, Managers/Admins see all projects
  const sidebarProjects = (() => {
    // If role not set yet, show all projects (safer default)
    if (!currentUserRole) {
      return projects;
    }
    // Regular users see only their projects
    if (currentUserRole === 'User' && (currentUserEmployeeName || currentUserEmployeeId)) {
      return projects.filter((project) => {
        // Check multiple assignments array (new preferred method)
        const projectAssignedToIds = (project as any).assignedToEmployeeIds;
        if (projectAssignedToIds && Array.isArray(projectAssignedToIds)) {
          if (projectAssignedToIds.some((id: any) => id?.toString() === currentUserEmployeeId)) {
            return true;
          }
        }
        const projectAssignedToNames = (project as any).assignedToNames;
        if (projectAssignedToNames && Array.isArray(projectAssignedToNames)) {
          if (projectAssignedToNames.includes(currentUserEmployeeName)) {
            return true;
          }
        }
        // Check single assignment (legacy)
        const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
        if (projectAssignedToId === currentUserEmployeeId || project.assignedTo === currentUserEmployeeName) return true;
        if (project.tasks && project.tasks.some(task => {
          const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
          return taskAssignedToId === currentUserEmployeeId || task.assignedTo === currentUserEmployeeName;
        })) return true;
        return false;
      });
    }
    // Managers/Admins see all projects
    return projects;
  })();

  const sidebarOperations = (() => {
    // If role not set yet, show all operations (safer default)
    if (!currentUserRole) {
      return operations;
    }
    // Regular users see only their operations
    if (currentUserRole === 'User' && (currentUserEmployeeName || currentUserEmployeeId)) {
      return operations.filter((operation) => {
        const opAssignedToId = (operation as any).assignedToEmployeeId?.toString();
        return opAssignedToId === currentUserEmployeeId || operation.assignedTo === currentUserEmployeeName;
      });
    }
    // Managers/Admins see all operations
    return operations;
  })();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 px-4 sm:px-6 lg:px-[100px]">
      <div className="w-full mx-auto pt-[30px] pb-8">
        {/* Header with Planning, Timeframe Selector, and Buttons */}
        <div className="mb-1">
          <div className="flex flex-row items-center gap-4 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-white whitespace-nowrap">Planning</h1>
            <TimeHorizonSelector 
              selected={timeframe} 
              onSelect={(newTimeframe) => {
                setTimeframe(newTimeframe);
                // If clicking "Today" while already in today view, reset date to actual today
                if (newTimeframe === 'today' && timeframe === 'today') {
                  setCurrentDate(new Date());
                }
              }} 
            />
            {isManagerOrAdmin && (
              <div className="flex gap-2 flex-shrink-0">
                <Button onClick={handleCreateProject}>+ New Project</Button>
                <Button onClick={handleCreateOperation} variant="secondary">+ New Operation</Button>
              </div>
            )}
          </div>
        </div>

        {/* Two column layout with sidebar on right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Calendar View</h2>
              {(currentUserRole === 'Manager' || currentUserRole === 'Administrator') && (
                <Toggle
                  label="Show only my assignments"
                  checked={showOnlyMyAssignments}
                  onChange={setShowOnlyMyAssignments}
                />
              )}
            </div>
            <CalendarView
              projects={filteredProjects}
              operations={filteredOperations}
              timeframe={timeframe}
              currentDate={currentDate}
              onProjectClick={handleViewProject}
              onOperationClick={handleViewOperation}
              onDateChange={setCurrentDate}
              currentUserEmployeeName={currentUserEmployeeName}
              currentUserEmployeeId={currentUserEmployeeId}
              isManagerOrAdmin={isManagerOrAdmin}
              showOnlyMyAssignments={showOnlyMyAssignments}
            />
          </div>

          <div className="lg:col-span-1">
            <EmployeeSidebar
              employees={employees}
              projects={sidebarProjects}
              operations={sidebarOperations}
              timeframe={timeframe}
              currentDate={currentDate}
              currentUserRole={currentUserRole}
              currentUserEmployeeId={currentUserEmployeeId}
            />
          </div>
        </div>

        <Modal
          isOpen={showProjectForm}
          onClose={() => {
            setShowProjectForm(false);
            setEditingProject(undefined);
          }}
          title={editingProject ? 'Edit Project' : 'New Project'}
        >
          <ProjectForm
            project={editingProject}
            timeframeType={timeframe}
            userRole={currentUserRole}
            onSubmit={handleSubmitProject}
            onCancel={() => {
              setShowProjectForm(false);
              setEditingProject(undefined);
            }}
          />
        </Modal>

        <Modal
          isOpen={showOperationForm}
          onClose={() => {
            setShowOperationForm(false);
            setEditingOperation(undefined);
          }}
          title={editingOperation ? 'Edit Operation' : 'New Operation'}
        >
          <OperationForm
            operation={editingOperation}
            recurrenceType={editingOperation?.recurrenceType || 'none'}
            onSubmit={handleSubmitOperation}
            onCancel={() => {
              setShowOperationForm(false);
              setEditingOperation(undefined);
            }}
          />
        </Modal>

        <Modal
          isOpen={showProjectDetail}
          onClose={() => {
            setShowProjectDetail(false);
            setViewingProject(undefined);
          }}
          title="Project"
          maxWidth="4xl"
          hideCloseButton={true}
          headerActions={
            viewingProject ? (
              <div className="flex items-center gap-2">
                {isManagerOrAdmin && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => handleEditProject(viewingProject)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => {
                      if (confirm('Are you sure you want to delete this project?')) {
                        handleDeleteProject(viewingProject._id.toString());
                      }
                    }}>
                      Delete
                    </Button>
                  </>
                )}
                {!isManagerOrAdmin && viewingProject.status === 'in-development' && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/projects/${viewingProject._id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: 'in-review' }),
                        });
                        if (response.ok) {
                          window.location.reload();
                        }
                      } catch (error) {
                        // Error updating status
                      }
                    }}
                  >
                    Mark as In Review
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => {
                  setShowProjectDetail(false);
                  setViewingProject(undefined);
                }}>
                  Close
                </Button>
              </div>
            ) : undefined
          }
        >
          {viewingProject && (
            <ProjectDetailView
              project={viewingProject}
              isManagerOrAdmin={isManagerOrAdmin}
              onEdit={() => handleEditProject(viewingProject)}
              onDelete={() => handleDeleteProject(viewingProject._id.toString())}
              onClose={() => {
                setShowProjectDetail(false);
                setViewingProject(undefined);
              }}
            />
          )}
        </Modal>

        <Modal
          isOpen={showOperationDetail}
          onClose={() => {
            setShowOperationDetail(false);
            setViewingOperation(undefined);
          }}
          title="Operation Details"
          headerActions={
            viewingOperation ? (
              <>
                {isManagerOrAdmin && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => handleEditOperation(viewingOperation)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => {
                      if (confirm('Are you sure you want to delete this operation?')) {
                        handleDeleteOperation(viewingOperation._id.toString());
                      }
                    }}>
                      Delete
                    </Button>
                  </>
                )}
                <Button variant="secondary" size="sm" onClick={() => {
                  setShowOperationDetail(false);
                  setViewingOperation(undefined);
                }}>
                  Close
                </Button>
              </>
            ) : undefined
          }
        >
          {viewingOperation && (
            <OperationDetailView
              operation={viewingOperation}
              onEdit={() => handleEditOperation(viewingOperation)}
              onDelete={() => handleDeleteOperation(viewingOperation._id.toString())}
              onClose={() => {
                setShowOperationDetail(false);
                setViewingOperation(undefined);
              }}
            />
          )}
        </Modal>
      </div>
    </div>
  );
}
