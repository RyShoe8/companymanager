'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { IOperation } from '@/lib/models/Operation';
import { IEmployee } from '@/lib/models/Employee';
import { IContentItem } from '@/lib/models/ContentItem';
import { TimeframeType, getTimeframeRange } from '@/lib/utils/dateUtils';
import { getProjectsForStage } from '@/lib/utils/statusMapping';
import TimeHorizonSelector from '@/components/planning-map/TimeHorizonSelector';
import CalendarView from '@/components/planning-map/CalendarView';
import EmployeeSidebar from '@/components/planning-map/EmployeeSidebar';
import InlineProjectView from '@/components/planning-map/InlineProjectView';
import InlineOperationView from '@/components/planning-map/InlineOperationView';
import OperationForm from '@/components/planning-map/OperationForm';
import QuickProjectForm from '@/components/planning-map/QuickProjectForm';
import ContentItemCreateModal from '@/components/planning-map/ContentItemCreateModal';
import ContentItemDetailModal from '@/components/planning-map/ContentItemDetailModal';
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
  const [contentItems, setContentItems] = useState<IContentItem[]>([]);
  const [showTasks, setShowTasks] = useState(true);
  const [showContent, setShowContent] = useState(true);
  const [contentChannelFilter, setContentChannelFilter] = useState<string>('All');
  const [addContentProject, setAddContentProject] = useState<IProject | null>(null);
  const [addContentDefaultDate, setAddContentDefaultDate] = useState<Date | undefined>(undefined);
  const [detailContentItemId, setDetailContentItemId] = useState<string | null>(null);
  const [contentRefreshTrigger, setContentRefreshTrigger] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const fetchContentItems = async () => {
    const { start, end } = getTimeframeRange(timeframe, currentDate);
    try {
      const res = await fetch(`/api/content-items?start=${start.toISOString().split('T')[0]}&end=${end.toISOString().split('T')[0]}`);
      if (res.ok) setContentItems(await res.json());
    } catch {}
  };

  useEffect(() => {
    const { start, end } = getTimeframeRange(timeframe, currentDate);
    fetch(`/api/content-items?start=${start.toISOString().split('T')[0]}&end=${end.toISOString().split('T')[0]}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setContentItems)
      .catch(() => {});
  }, [timeframe, currentDate]);

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
      const { start, end } = getTimeframeRange(timeframe, currentDate);
      const contentRes = await fetch(`/api/content-items?start=${start.toISOString().split('T')[0]}&end=${end.toISOString().split('T')[0]}`);
      if (contentRes.ok) setContentItems(await contentRes.json());

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
            <div className="mb-4 flex flex-wrap items-center gap-4 justify-between">
              <h2 className="text-xl font-semibold text-white">Launched Projects & Operations</h2>
              <div className="flex flex-wrap items-center gap-4">
                <Toggle label="Show Tasks" checked={showTasks} onChange={setShowTasks} />
                <Toggle label="Show Content" checked={showContent} onChange={setShowContent} />
                <select value={contentChannelFilter} onChange={(e) => setContentChannelFilter(e.target.value)} className="rounded border border-border bg-background-card text-text-primary px-2 py-1 text-sm">
                  <option value="All">All channels</option>
                  <option value="SEO">SEO</option><option value="X">X</option><option value="LinkedIn">LinkedIn</option><option value="Instagram">Instagram</option><option value="TikTok">TikTok</option><option value="Email">Email</option><option value="Other">Other</option>
                </select>
                {(currentUserRole === 'Manager' || currentUserRole === 'Administrator') && (
                  <Toggle label="Show only my assignments" checked={showOnlyMyAssignments} onChange={setShowOnlyMyAssignments} />
                )}
              </div>
            </div>
            <CalendarView
              projects={filteredProjects}
              operations={filteredOperations}
              contentItems={contentItems}
              showTasks={showTasks}
              showContent={showContent}
              contentChannelFilter={contentChannelFilter}
              timeframe={timeframe}
              currentDate={currentDate}
              onProjectClick={handleViewProject}
              onOperationClick={handleViewOperation}
              onDateChange={setCurrentDate}
              currentUserEmployeeName={currentUserEmployeeName}
              currentUserEmployeeId={currentUserEmployeeId}
              isManagerOrAdmin={isManagerOrAdmin}
              showOnlyMyAssignments={showOnlyMyAssignments}
              onRefreshContent={fetchContentItems}
              onAddContent={(project, defaultDate) => { setAddContentProject(project); setAddContentDefaultDate(defaultDate); }}
              onContentItemClick={(item) => setDetailContentItemId(item._id.toString())}
            />
          </div>

          <div className="lg:col-span-1">
            <EmployeeSidebar
              employees={employees}
              projects={filteredProjects}
              operations={filteredOperations}
              allProjects={allProjects}
              allOperations={allOperations}
              timeframe={timeframe}
              currentDate={currentDate}
              currentUserRole={currentUserRole}
              currentUserEmployeeId={currentUserEmployeeId}
            />
          </div>
        </div>

        <ContentItemCreateModal isOpen={!!addContentProject} onClose={() => { setAddContentProject(null); setAddContentDefaultDate(undefined); }} project={addContentProject} defaultPublishDate={addContentDefaultDate} employees={employees} onSuccess={fetchContentItems} />
        <ContentItemDetailModal isOpen={!!detailContentItemId} onClose={() => setDetailContentItemId(null)} contentItemId={detailContentItemId} employees={employees} onSaved={() => { fetchContentItems(); setContentRefreshTrigger((t) => t + 1); }} onDeleted={() => { fetchContentItems(); setContentRefreshTrigger((t) => t + 1); }} />

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
        <BottomSheet isOpen={showProjectDetail} onClose={() => { setShowProjectDetail(false); setViewingProject(undefined); }} title={viewingProject?.name || 'Project'} maxHeight="90vh" hideCloseButton>
          {viewingProject && (
            <div className="p-4">
              <InlineProjectView project={viewingProject} employees={employees} isManagerOrAdmin={isManagerOrAdmin} currentUserEmployeeId={currentUserEmployeeId}
                onAddOperation={(projectId) => handleCreateOperation(projectId)}
                onAddContent={(proj) => { setAddContentProject(proj); setAddContentDefaultDate(undefined); }}
                onContentItemClick={(item) => setDetailContentItemId(item._id.toString())}
                contentRefreshTrigger={contentRefreshTrigger}
                onUpdate={async (updates) => { 
                  if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) throw new Error('No changes to save');
                  const body = JSON.stringify(updates);
                  if (!body || body === '{}') throw new Error('No changes to save');

                  const projectId = viewingProject._id?.toString() ?? viewingProject._id;
                  const res = await fetch(`/api/projects/${projectId}`, { 
                    method: 'PUT', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: body
                  }); 
                  if (!res.ok) { 
                    const errorText = await res.text();
                    throw new Error(errorText || 'Failed to save');
                  }
                  const updatedProject = await res.json();
                  const newStatus = updatedProject.status;
                  if (newStatus && newStatus !== 'launched' && newStatus !== 'completed') {
                    setShowProjectDetail(false);
                    setViewingProject(undefined);
                    await loadData();
                    if (newStatus === 'in-development') {
                      router.push(`/build/${updatedProject._id?.toString() ?? updatedProject._id}`);
                    }
                    return;
                  }
                  setViewingProject(updatedProject);
                  setProjects(prev => prev.map(p => p._id.toString() === updatedProject._id.toString() ? updatedProject : p));
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
                  const res = await fetch(`/api/operations/${viewingOperation._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }); 
                  if (!res.ok) { 
                    const errorText = await res.text();
                    throw new Error(errorText || 'Failed to save');
                  }
                  const updatedOperation = await res.json();
                  setViewingOperation(updatedOperation);
                  await loadData();
                  const freshOperations = await fetch('/api/operations').then(r => r.json());
                  const freshOperation = freshOperations.find((op: IOperation) => op._id.toString() === viewingOperation._id.toString());
                  if (freshOperation) setViewingOperation(freshOperation);
                }}
                onDelete={() => handleDeleteOperation(viewingOperation._id.toString())}
                onClose={() => { setShowOperationDetail(false); setViewingOperation(undefined); }} onRefresh={loadData} />
            </div>
          )}
        </BottomSheet>

        {/* New / Edit Operation - elevated so it appears above the project detail sheet */}
        {isMobile ? (
          <BottomSheet isOpen={showOperationForm} onClose={closeOperationForm} title={editingOperation ? 'Edit Operation' : 'New Operation'} elevated>
            <div className="p-4">
              <OperationForm
                operation={editingOperation}
                onSubmit={handleSubmitOperation}
                onCancel={closeOperationForm}
              />
            </div>
          </BottomSheet>
        ) : (
          <Modal isOpen={showOperationForm} onClose={closeOperationForm} title={editingOperation ? 'Edit Operation' : 'New Operation'} elevated>
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
