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
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

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
  const [editingProject, setEditingProject] = useState<IProject | undefined>();
  const [editingOperation, setEditingOperation] = useState<IOperation | undefined>();

  useEffect(() => {
    loadData();
  }, [timeframe]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsRes, operationsRes, employeesRes] = await Promise.all([
        fetch(`/api/projects?timeframeType=${timeframe}`),
        fetch(`/api/operations?recurrenceType=${timeframe === 'today' ? 'weekly' : timeframe}`),
        fetch('/api/employees'),
      ]);

      // Filter employees to exclude the current user's admin employee record if needed
      // (or show all employees in the organization)

      if (projectsRes.status === 401 || operationsRes.status === 401 || employeesRes.status === 401) {
        router.push('/login');
        return;
      }

      const projectsData = await projectsRes.json();
      const operationsData = await operationsRes.json();
      const employeesData = await employeesRes.json();

      // For monthly view, load all projects (calendar handles filtering)
      // For other timeframes, filter by date range
      let filteredProjects = projectsData;
      if (timeframe !== 'monthly') {
        const range = getTimeframeRange(timeframe);
        filteredProjects = projectsData.filter((project: IProject) => {
          const start = new Date(project.startDate);
          const end = new Date(project.endDate);
          return (start <= range.end && end >= range.start);
        });
      }

      setProjects(filteredProjects);
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

  const handleEditProject = (project: IProject) => {
    setEditingProject(project);
    setShowProjectForm(true);
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (response.ok) {
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
        setEditingProject(undefined);
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

  const handleEditOperation = (operation: IOperation) => {
    setEditingOperation(operation);
    setShowOperationForm(true);
  };

  const handleDeleteOperation = async (id: string) => {
    try {
      const response = await fetch(`/api/operations/${id}`, { method: 'DELETE' });
      if (response.ok) {
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
        setEditingOperation(undefined);
        loadData();
      }
    } catch (error) {
      console.error('Error saving operation:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-[100px] max-md:px-4">
      <div className="w-full mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Planning</h1>
            <div className="flex gap-2">
              <Button onClick={handleCreateProject}>+ New Project</Button>
              <Button onClick={handleCreateOperation} variant="secondary">+ New Operation</Button>
            </div>
          </div>
          <TimeHorizonSelector selected={timeframe} onSelect={setTimeframe} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Calendar View</h2>
                    <CalendarView
                      projects={projects}
                      timeframe={timeframe}
                      currentDate={currentDate}
                      onProjectClick={handleEditProject}
                    />
          </div>

          <div>
            <EmployeeSidebar
              employees={employees}
              projects={projects}
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
            recurrenceType={timeframe === 'today' ? 'weekly' : timeframe}
            onSubmit={handleSubmitOperation}
            onCancel={() => {
              setShowOperationForm(false);
              setEditingOperation(undefined);
            }}
          />
        </Modal>
      </div>
    </div>
  );
}
