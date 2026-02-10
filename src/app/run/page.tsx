'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { IOperation } from '@/lib/models/Operation';
import { IEmployee } from '@/lib/models/Employee';
import { TimeframeType } from '@/lib/utils/dateUtils';
import { getProjectsForStage } from '@/lib/utils/statusMapping';
import TimeHorizonSelector from '@/components/planning-map/TimeHorizonSelector';
import CalendarView from '@/components/planning-map/CalendarView';
import EmployeeSidebar from '@/components/planning-map/EmployeeSidebar';
import InlineProjectView from '@/components/planning-map/InlineProjectView';
import InlineOperationView from '@/components/planning-map/InlineOperationView';
import OperationForm from '@/components/planning-map/OperationForm';
import QuickProjectForm from '@/components/planning-map/QuickProjectForm';
import Modal from '@/components/ui/Modal';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import useIsMobile from '@/lib/hooks/useIsMobile';

export default function RunPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [timeframe, setTimeframe] = useState<TimeframeType>('today');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [projects, setProjects] = useState<IProject[]>([]);
  const [operations, setOperations] = useState<IOperation[]>([]);
  const [allProjects, setAllProjects] = useState<IProject[]>([]);
  const [allOperations, setAllOperations] = useState<IOperation[]>([]);
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showProjectDetail, setShowProjectDetail] = useState(false);
  const [showOperationForm, setShowOperationForm] = useState(false);
  const [operationFormProjectId, setOperationFormProjectId] = useState<string | null>(null);
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
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsRes, operationsRes, employeesRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/operations'),
        fetch('/api/employees'),
      ]);

      if (projectsRes.status === 401 || operationsRes.status === 401 || employeesRes.status === 401) {
        router.push('/login');
        return;
      }

      const projectsData = await projectsRes.json();
      const operationsData = await operationsRes.json();
      const employeesData = await employeesRes.json();

      // Get current user's role and employee info
      try {
        const userResponse = await fetch('/api/auth/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData && userData.id) {
            let currentEmployee = employeesData.find((emp: IEmployee) => emp.userId?.toString() === userData.id);
            if (!currentEmployee && userData.email) {
              currentEmployee = employeesData.find((emp: IEmployee) => emp.email?.toLowerCase() === userData.email?.toLowerCase());
            }
            if (currentEmployee) {
              const role = currentEmployee.role || 'User';
              setIsManagerOrAdmin(role === 'Manager' || role === 'Administrator');
              setCurrentUserRole(role as 'Administrator' | 'Manager' | 'User');
              setCurrentUserEmployeeName(currentEmployee.name || null);
              setCurrentUserEmployeeId(currentEmployee._id?.toString() || null);
            }
          }
        }
      } catch (error) {
        // Error loading current user
      }

      // Filter to Run stage projects (launched status)
      const runProjects = getProjectsForStage(projectsData, 'Run');
      setProjects(runProjects);
      // Store all projects/operations for calculations (across all stages)
      setAllProjects(projectsData);
      setAllOperations(operationsData);
      setOperations(operationsData);
      setEmployees(employeesData);
      
      // Update viewing project/operation if they exist to reflect latest data
      if (viewingProject?._id) {
        const updatedProject = runProjects.find((p: IProject) => p._id.toString() === viewingProject._id.toString());
        if (updatedProject) {
          setViewingProject(updatedProject);
        }
      }
      if (viewingOperation?._id) {
        const updatedOperation = operationsData.find((op: IOperation) => op._id.toString() === viewingOperation._id.toString());
        if (updatedOperation) {
          setViewingOperation(updatedOperation);
        }
      }
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

  const handleCreateOperation = (projectId?: string) => {
    setEditingOperation(undefined);
    setOperationFormProjectId(projectId ?? null);
    setShowOperationForm(true);
  };

  const handleViewProject = (project: IProject) => {
    setViewingProject(project);
    setShowProjectDetail(true);
  };

  const handleViewOperation = (operation: IOperation) => {
    setViewingOperation(operation);
    setShowOperationDetail(true);
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

  const handleSubmitOperation = async (data: Partial<IOperation>) => {
    try {
      if (editingOperation) {
        const res = await fetch(`/api/operations/${editingOperation._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          setShowOperationForm(false);
          setEditingOperation(undefined);
          setOperationFormProjectId(null);
          await loadData();
        } else {
          const text = await res.text();
          alert(`Failed to update operation: ${text}`);
        }
      } else {
        const projectId = operationFormProjectId;
        if (!projectId) {
          alert('Project is required to create an operation. Add an operation from a project view.');
          return;
        }
        const res = await fetch('/api/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, projectId }),
        });
        if (res.ok) {
          setShowOperationForm(false);
          setOperationFormProjectId(null);
          await loadData();
        } else {
          const text = await res.text();
          alert(`Failed to create operation: ${text}`);
        }
      }
    } catch (error) {
      console.error('Error saving operation:', error);
      alert('Error saving operation. Please try again.');
    }
  };

  const closeOperationForm = () => {
    setShowOperationForm(false);
    setEditingOperation(undefined);
    setOperationFormProjectId(null);
  };

  // Filter projects and operations based on user role and toggle
  const filteredProjects = (() => {
    if (!currentUserRole) return projects;
    
    if (currentUserRole === 'User' && (currentUserEmployeeName || currentUserEmployeeId)) {
      return projects.filter((project) => {
        const projectAssignedToIds = (project as any).assignedToEmployeeIds;
        if (projectAssignedToIds && Array.isArray(projectAssignedToIds)) {
          if (projectAssignedToIds.some((id: any) => id?.toString() === currentUserEmployeeId)) return true;
        }
        const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
        if (projectAssignedToId === currentUserEmployeeId || project.assignedTo === currentUserEmployeeName) return true;
        if (project.tasks?.some(task => {
          const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
          return taskAssignedToId === currentUserEmployeeId || task.assignedTo === currentUserEmployeeName;
        })) return true;
        return false;
      });
    }
    
    if (showOnlyMyAssignments && (currentUserEmployeeName || currentUserEmployeeId)) {
      return projects.filter((project) => {
        const projectAssignedToIds = (project as any).assignedToEmployeeIds;
        if (projectAssignedToIds && Array.isArray(projectAssignedToIds)) {
          if (projectAssignedToIds.some((id: any) => id?.toString() === currentUserEmployeeId)) return true;
        }
        const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
        if (projectAssignedToId === currentUserEmployeeId || project.assignedTo === currentUserEmployeeName) return true;
        if (project.tasks?.some(task => {
          const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
          return taskAssignedToId === currentUserEmployeeId || task.assignedTo === currentUserEmployeeName;
        })) return true;
        return false;
      });
    }
    
    return projects;
  })();

  const filteredOperations = (() => {
    if (!currentUserRole) return operations;
    
    if (currentUserRole === 'User' && (currentUserEmployeeName || currentUserEmployeeId)) {
      return operations.filter((operation) => {
        const opAssignedToId = (operation as any).assignedToEmployeeId?.toString();
        return opAssignedToId === currentUserEmployeeId || operation.assignedTo === currentUserEmployeeName;
      });
    }
    
    if (showOnlyMyAssignments && (currentUserEmployeeName || currentUserEmployeeId)) {
      return operations.filter((operation) => {
        const opAssignedToId = (operation as any).assignedToEmployeeId?.toString();
        return opAssignedToId === currentUserEmployeeId || operation.assignedTo === currentUserEmployeeName;
      });
    }
    
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
        {/* Header with Run, Timeframe Selector, and Buttons */}
        <div className="mb-1">
          <div className="flex flex-row items-center gap-4 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-white whitespace-nowrap">Run</h1>
            <TimeHorizonSelector 
              selected={timeframe} 
              onSelect={(newTimeframe) => {
                setTimeframe(newTimeframe);
                if (newTimeframe === 'today' && timeframe === 'today') {
                  setCurrentDate(new Date());
                }
              }} 
            />
            {isManagerOrAdmin && (
              <div className="flex gap-2 flex-shrink-0">
                <Button onClick={handleCreateProject} variant="secondary">+ New Project</Button>
              </div>
            )}
          </div>
        </div>

        {/* Two column layout with sidebar on right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Launched Projects & Operations</h2>
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
              projects={filteredProjects}
              operations={filteredOperations}
              timeframe={timeframe}
              currentDate={currentDate}
              currentUserRole={currentUserRole}
              currentUserEmployeeId={currentUserEmployeeId}
            />
          </div>
        </div>

        {/* Quick Project Creation */}
        {isMobile ? (
          <BottomSheet isOpen={showProjectForm} onClose={() => { setShowProjectForm(false); setEditingProject(undefined); }} title="New Project">
            <div className="p-4"><QuickProjectForm employees={employees} defaultStatus="launched" onSubmit={handleSubmitProject} onCancel={() => { setShowProjectForm(false); setEditingProject(undefined); }} /></div>
          </BottomSheet>
        ) : (
          <Modal isOpen={showProjectForm} onClose={() => { setShowProjectForm(false); setEditingProject(undefined); }} title="New Project">
            <QuickProjectForm employees={employees} defaultStatus="launched" onSubmit={handleSubmitProject} onCancel={() => { setShowProjectForm(false); setEditingProject(undefined); }} />
          </Modal>
        )}

        {/* Inline Project View - Full width bottom sheet on all devices */}
        <BottomSheet isOpen={showProjectDetail} onClose={() => { setShowProjectDetail(false); setViewingProject(undefined); }} title={viewingProject?.name || 'Project'} maxHeight="90vh">
          {viewingProject && (
            <div className="p-4">
              <InlineProjectView project={viewingProject} employees={employees} isManagerOrAdmin={isManagerOrAdmin} currentUserEmployeeId={currentUserEmployeeId}
                onAddOperation={(projectId) => handleCreateOperation(projectId)}
                onUpdate={async (updates) => { 
                  try {
                    // Validate updates object
                    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
                      console.error('Invalid updates object:', updates);
                      alert('Error: No changes to save');
                      return;
                    }

                    const body = JSON.stringify(updates);
                    if (!body || body === '{}') {
                      console.error('Empty updates body:', updates);
                      alert('Error: No changes to save');
                      return;
                    }

                    const projectId = viewingProject._id?.toString() ?? viewingProject._id;
                    const res = await fetch(`/api/projects/${projectId}`, { 
                      method: 'PUT', 
                      headers: { 'Content-Type': 'application/json' }, 
                      body: body
                    }); 
                    
                    if (res.ok) { 
                      const updatedProject = await res.json();
                      const newStatus = updatedProject.status;
                      // If status changed to another stage, close sheet and refresh so user sees feedback
                      if (newStatus && newStatus !== 'launched' && newStatus !== 'completed') {
                        setShowProjectDetail(false);
                        setViewingProject(undefined);
                        await loadData();
                        if (newStatus === 'in-development') {
                          router.push(`/build/${updatedProject._id?.toString() ?? updatedProject._id}`);
                        }
                        return;
                      }
                      // Update viewing project immediately
                      setViewingProject(updatedProject);
                      // Update projects array without full reload
                      setProjects(prev => prev.map(p => p._id.toString() === updatedProject._id.toString() ? updatedProject : p));
                    } else {
                      const errorText = await res.text();
                      console.error('Failed to update project:', errorText);
                      alert(`Failed to save changes: ${errorText}`);
                    }
                  } catch (error) {
                    console.error('Error updating project:', error);
                    alert(`Error saving changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                }}
                onDelete={() => handleDeleteProject(viewingProject._id.toString())}
                onClose={() => { setShowProjectDetail(false); setViewingProject(undefined); }} onRefresh={loadData} />
            </div>
          )}
        </BottomSheet>

        {/* Inline Operation View - Full width bottom sheet on all devices */}
        <BottomSheet isOpen={showOperationDetail} onClose={() => { setShowOperationDetail(false); setViewingOperation(undefined); }} title={viewingOperation?.name || 'Operation'} maxHeight="90vh">
          {viewingOperation && (
            <div className="p-4">
              <InlineOperationView operation={viewingOperation} employees={employees} projects={projects} isManagerOrAdmin={isManagerOrAdmin} currentUserEmployeeId={currentUserEmployeeId}
                onUpdate={async (updates) => { 
                  try {
                    const res = await fetch(`/api/operations/${viewingOperation._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }); 
                    if (res.ok) { 
                      const updatedOperation = await res.json();
                      // Update local state immediately for optimistic UI
                      setViewingOperation(updatedOperation);
                      // Then refresh all data to ensure consistency
                      await loadData();
                      // After loadData completes, update viewing state with fresh data
                      const freshOperations = await fetch('/api/operations').then(r => r.json());
                      const freshOperation = freshOperations.find((op: IOperation) => op._id.toString() === viewingOperation._id.toString());
                      if (freshOperation) {
                        setViewingOperation(freshOperation);
                      }
                    } else {
                      const errorText = await res.text();
                      console.error('Failed to update operation:', errorText);
                      alert(`Failed to save changes: ${errorText}`);
                    }
                  } catch (error) {
                    console.error('Error updating operation:', error);
                    alert('Error saving changes. Please try again.');
                  }
                }}
                onDelete={() => handleDeleteOperation(viewingOperation._id.toString())}
                onClose={() => { setShowOperationDetail(false); setViewingOperation(undefined); }} onRefresh={loadData} />
            </div>
          )}
        </BottomSheet>

        {/* New / Edit Operation */}
        {isMobile ? (
          <BottomSheet isOpen={showOperationForm} onClose={closeOperationForm} title={editingOperation ? 'Edit Operation' : 'New Operation'}>
            <div className="p-4">
              <OperationForm
                operation={editingOperation}
                onSubmit={handleSubmitOperation}
                onCancel={closeOperationForm}
              />
            </div>
          </BottomSheet>
        ) : (
          <Modal isOpen={showOperationForm} onClose={closeOperationForm} title={editingOperation ? 'Edit Operation' : 'New Operation'}>
            <OperationForm
              operation={editingOperation}
              onSubmit={handleSubmitOperation}
              onCancel={closeOperationForm}
            />
          </Modal>
        )}
      </div>
    </div>
  );
}
