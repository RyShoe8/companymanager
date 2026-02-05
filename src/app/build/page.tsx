'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { IOperation } from '@/lib/models/Operation';
import { IEmployee } from '@/lib/models/Employee';
import { TimeframeType } from '@/lib/utils/dateUtils';
import { getProjectsForStage } from '@/lib/utils/statusMapping';
import useIsMobile from '@/lib/hooks/useIsMobile';
import TimeHorizonSelector from '@/components/planning-map/TimeHorizonSelector';
import CalendarView from '@/components/planning-map/CalendarView';
import EmployeeSidebar from '@/components/planning-map/EmployeeSidebar';
import InlineProjectView from '@/components/planning-map/InlineProjectView';
import QuickProjectForm from '@/components/planning-map/QuickProjectForm';
import Modal from '@/components/ui/Modal';
import BottomSheet from '@/components/ui/BottomSheet';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';

export default function BuildPage() {
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
  const [editingProject, setEditingProject] = useState<IProject | undefined>();
  const [viewingProject, setViewingProject] = useState<IProject | undefined>();
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

      // Filter to Build stage projects (in-development status)
      const buildProjects = getProjectsForStage(projectsData, 'Build');
      setProjects(buildProjects);
      // Store all projects/operations for calculations (across all stages)
      setAllProjects(projectsData);
      setAllOperations(operationsData);
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
      
      // Ensure new projects start in in-development status
      const projectData = editingProject ? data : { ...data, status: 'in-development' };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
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

  // Filter projects based on user role and toggle
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
        {/* Header with Build, Timeframe Selector, and Buttons */}
        <div className="mb-1">
          <div className="flex flex-row items-center gap-4 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-white whitespace-nowrap">Build</h1>
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
                <Button onClick={handleCreateProject}>+ New Project</Button>
              </div>
            )}
          </div>
        </div>

        {/* Two column layout with sidebar on right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Projects in Development</h2>
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
              operations={[]}
              timeframe={timeframe}
              currentDate={currentDate}
              onProjectClick={handleViewProject}
              onOperationClick={() => {}}
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
              operations={[]}
              allProjects={allProjects}
              allOperations={allOperations}
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
            <div className="p-4"><QuickProjectForm employees={employees} defaultStatus="in-development" onSubmit={handleSubmitProject} onCancel={() => { setShowProjectForm(false); setEditingProject(undefined); }} /></div>
          </BottomSheet>
        ) : (
          <Modal isOpen={showProjectForm} onClose={() => { setShowProjectForm(false); setEditingProject(undefined); }} title="New Project">
            <QuickProjectForm employees={employees} defaultStatus="in-development" onSubmit={handleSubmitProject} onCancel={() => { setShowProjectForm(false); setEditingProject(undefined); }} />
          </Modal>
        )}

        {/* Inline Project View - Full width bottom sheet on all devices */}
        <BottomSheet isOpen={showProjectDetail} onClose={() => { setShowProjectDetail(false); setViewingProject(undefined); }} title={viewingProject?.name || 'Project'} maxHeight="90vh">
          {viewingProject && (
            <div className="p-4">
              <InlineProjectView project={viewingProject} employees={employees} isManagerOrAdmin={isManagerOrAdmin} currentUserEmployeeId={currentUserEmployeeId}
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

                    const res = await fetch(`/api/projects/${viewingProject._id}`, { 
                      method: 'PUT', 
                      headers: { 'Content-Type': 'application/json' }, 
                      body: body
                    }); 
                    
                    if (res.ok) { 
                      const updatedProject = await res.json();
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
      </div>
    </div>
  );
}
