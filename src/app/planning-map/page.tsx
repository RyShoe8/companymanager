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
          const currentEmployee = employeesData.find((emp: IEmployee) => emp.userId?.toString() === userData.id);
          const role = currentEmployee?.role || 'User';
          setIsManagerOrAdmin(role === 'Manager' || role === 'Administrator');
          setCurrentUserRole(role as 'Administrator' | 'Manager' | 'User');
          setCurrentUserEmployeeName(currentEmployee?.name || null);
        }
      } catch (error) {
        console.error('Error loading current user:', error);
      }

      // Pass all projects to CalendarView - it will handle date filtering based on its viewDate
      setProjects(projectsData);
      setOperations(operationsData);
      setEmployees(employeesData);
    } catch (error) {
      console.error('Error loading data:', error);
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
      console.error('Error deleting project:', error);
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
      console.error('Error saving project:', error);
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
      console.error('Error deleting operation:', error);
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
      console.error('Error saving operation:', error);
    }
  };

  // Filter projects and operations based on toggle
  const filteredProjects = showOnlyMyAssignments && currentUserEmployeeName
    ? projects.filter((project) => {
        // Show if assigned to user
        if (project.assignedTo === currentUserEmployeeName) return true;
        // Show if any stage is assigned to user
        if (project.stages && project.stages.some(stage => stage.assignedTo === currentUserEmployeeName)) return true;
        return false;
      })
    : projects;

  const filteredOperations = showOnlyMyAssignments && currentUserEmployeeName
    ? operations.filter((operation) => operation.assignedTo === currentUserEmployeeName)
    : operations;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-[100px] py-8">
      <div className="w-full mx-auto">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Planning</h1>
            {isManagerOrAdmin && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleCreateProject} className="w-full sm:w-auto">+ New Project</Button>
                <Button onClick={handleCreateOperation} variant="secondary" className="w-full sm:w-auto">+ New Operation</Button>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <TimeHorizonSelector selected={timeframe} onSelect={setTimeframe} />
            <Toggle
              label="Show only my assignments"
              checked={showOnlyMyAssignments}
              onChange={setShowOnlyMyAssignments}
              className="ml-auto"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-text-primary">Calendar View</h2>
            </div>
            <CalendarView
              projects={filteredProjects}
              operations={filteredOperations}
              timeframe={timeframe}
              currentDate={currentDate}
              onProjectClick={handleViewProject}
              onOperationClick={handleViewOperation}
              onDateChange={setCurrentDate}
            />
          </div>

          <div>
            <EmployeeSidebar
              employees={employees}
              projects={filteredProjects}
              operations={filteredOperations}
              timeframe={timeframe}
              currentDate={currentDate}
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
            recurrenceType={
              timeframe === 'today' || timeframe === 'quarterly' || timeframe === 'yearly' 
                ? 'weekly' 
                : timeframe === 'monthly' 
                  ? 'monthly' 
                  : 'weekly'
            }
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
          title="Project Details"
          maxWidth="4xl"
          headerActions={
            viewingProject ? (
              <>
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
                {!isManagerOrAdmin && viewingProject.status === 'active' && (
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
                        console.error('Error updating status:', error);
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
              </>
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
