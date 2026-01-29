'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IProject, TaskStatus } from '@/lib/models/Project';
import { IAsset } from '@/lib/models/Asset';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ProjectForm from '@/components/planning-map/ProjectForm';
import { IEmployee } from '@/lib/models/Employee';
import { formatDate } from '@/lib/utils/dateUtils';
import Select from '@/components/ui/Select';
import WireframeButton from '@/components/wireframes/WireframeButton';
import WireframeViewer from '@/components/wireframes/WireframeViewer';
import ProjectLogo from '@/components/projects/ProjectLogo';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<IProject[]>([]);
  const [assets, setAssets] = useState<IAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<IProject | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [currentUserEmployeeName, setCurrentUserEmployeeName] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'Administrator' | 'Manager' | 'User' | undefined>();
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [showWireframe, setShowWireframe] = useState(false);
  const [wireframeProjectId, setWireframeProjectId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Auto-select first project if none selected
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0]._id.toString());
    }
  }, [projects, selectedProjectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsRes, assetsRes, employeesRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/assets'),
        fetch('/api/employees'),
      ]);

      if (projectsRes.status === 401 || assetsRes.status === 401 || employeesRes.status === 401) {
        router.push('/login');
        return;
      }

      const projectsData = await projectsRes.json();
      const assetsData = await assetsRes.json();
      const employeesData = await employeesRes.json();

      // Get current user's employee name and role
      try {
        const userResponse = await fetch('/api/auth/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData && userData.id) {
            const currentEmployee = employeesData.find((emp: IEmployee) => emp.userId?.toString() === userData.id);
            setCurrentUserEmployeeName(currentEmployee?.name || null);
            setCurrentUserRole(currentEmployee?.role as 'Administrator' | 'Manager' | 'User' | undefined);
          }
        }
      } catch (error) {
        // Error loading current user
      }

      setProjects(projectsData);
      setAssets(assetsData);
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

  const handleEditProject = (project: IProject) => {
    setEditingProject(project);
    setShowProjectForm(true);
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
        await loadData();
        // Select the newly created/edited project
        if (editingProject) {
          setSelectedProjectId(editingProject._id.toString());
        } else if (response.ok) {
          const newProject = await response.json();
          setSelectedProjectId(newProject._id.toString());
        }
      }
    } catch (error) {
      // Error saving project
    }
  };

  const getProjectAssets = (projectId: string, taskIndex?: number) => {
    return assets.filter((asset) => {
      if (asset.linkedProjectId?.toString() !== projectId) return false;
      if (taskIndex !== undefined) {
        return asset.linkedProjectTaskIndex === taskIndex;
      }
      return asset.linkedProjectTaskIndex === undefined;
    });
  };

  const getProjectAssetsByType = (projectId: string, type: string, taskIndex?: number) => {
    return getProjectAssets(projectId, taskIndex).filter(asset => asset.type === type);
  };

  const selectedProject = projects.find(p => p._id.toString() === selectedProjectId);
  const activeTasks = selectedProject?.tasks?.filter(t => t.status !== 'completed') || [];
  const completedTasks = selectedProject?.tasks?.filter(t => t.status === 'completed') || [];

  // Calculate employee utilization for the selected project
  const calculateEmployeeUtilization = () => {
    if (!selectedProject) return [];

    const utilizationMap = new Map<string, { name: string; projectHours: number; taskHours: number; completedHours: number; totalHours: number }>();

    // Get all unique employee names from project and tasks
    const employeeNames = new Set<string>();
    if (selectedProject.assignedTo) {
      employeeNames.add(selectedProject.assignedTo);
    }
    if (selectedProject.tasks) {
      selectedProject.tasks.forEach(task => {
        if (task.assignedTo) {
          employeeNames.add(task.assignedTo);
        }
      });
    }

    // Calculate hours for each employee
    employeeNames.forEach(employeeName => {
      let projectHours = 0;
      let taskHours = 0;
      let completedHours = 0;

      // Project-level hours (only if employee is assigned to project)
      if (selectedProject.assignedTo === employeeName && selectedProject.estimatedHours) {
        // Calculate total hours assigned via tasks (to anyone)
        let totalTaskHours = 0;
        if (selectedProject.tasks) {
          selectedProject.tasks.forEach(task => {
            if (task.assignedTo && task.estimatedHours && task.status !== 'completed') {
              totalTaskHours += task.estimatedHours;
            }
          });
        }
        // Project hours minus task hours = remaining project hours
        projectHours = Math.max(0, selectedProject.estimatedHours - totalTaskHours);
      }

      // Task-level hours (active and completed)
      if (selectedProject.tasks) {
        selectedProject.tasks.forEach(task => {
          if (task.assignedTo === employeeName && task.estimatedHours) {
            if (task.status === 'completed') {
              completedHours += task.estimatedHours;
            } else {
              taskHours += task.estimatedHours;
            }
          }
        });
      }

      const totalHours = projectHours + taskHours + completedHours;
      if (totalHours > 0) {
        utilizationMap.set(employeeName, {
          name: employeeName,
          projectHours,
          taskHours,
          completedHours,
          totalHours
        });
      }
    });

    return Array.from(utilizationMap.values()).sort((a, b) => b.totalHours - a.totalHours);
  };

  const employeeUtilization = calculateEmployeeUtilization();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 px-4 sm:px-6 lg:px-[100px] py-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 px-4 sm:px-6 lg:px-[100px] py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Projects Dropdown */}
        <div className="flex justify-end items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">Projects:</span>
            <Select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              options={projects.map(p => ({
                value: p._id.toString(),
                label: p.name
              }))}
              className="min-w-[200px] bg-white"
            />
          </div>
          <Button onClick={handleCreateProject}>+ Add Project</Button>
        </div>

        {/* Project Details */}
        {selectedProject ? (
          <div className="space-y-6">
            {/* Project Overview */}
            <Card className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <ProjectLogo
                      projectId={selectedProject._id.toString()}
                      logo={selectedProject.logo}
                      color={selectedProject.color}
                      isManagerOrAdmin={currentUserRole === 'Administrator' || currentUserRole === 'Manager'}
                      onLogoUpdate={async (logoUrl) => {
                        try {
                          const response = await fetch(`/api/projects/${selectedProject._id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ logo: logoUrl }),
                          });
                          if (response.ok) {
                            await loadData();
                          }
                        } catch (error) {
                          console.error('Error updating logo:', error);
                        }
                      }}
                    />
                    <h1 className={`text-3xl font-bold text-gray-900 dark:text-white ${selectedProject.status === 'completed' ? 'line-through opacity-75' : ''}`}>
                      {selectedProject.name}
                    </h1>
                    <span className={`text-xs px-3 py-1 rounded font-medium ${
                      selectedProject.status === 'completed' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                      selectedProject.status === 'in-development' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      selectedProject.status === 'in-review' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      selectedProject.status === 'launched' ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                      {selectedProject.status === 'completed' ? 'Completed' :
                       selectedProject.status === 'in-development' ? 'In Development' :
                       selectedProject.status === 'in-review' ? 'In Review' :
                       selectedProject.status === 'launched' ? 'Launched' :
                       'Planning'}
                    </span>
                  </div>
                  
                  {selectedProject.description && (
                    <p className="text-gray-600 dark:text-gray-400 mb-4">{selectedProject.description}</p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Dates: </span>
                      <span className="text-gray-900 dark:text-white">
                        {(() => {
                          // Projects don't have startDate - use createdAt or earliest task startDate
                          let startDate: Date;
                          if (selectedProject.tasks && selectedProject.tasks.length > 0) {
                            const earliestTask = selectedProject.tasks.reduce((earliest, task) => {
                              return new Date(task.startDate) < new Date(earliest.startDate) ? task : earliest;
                            });
                            startDate = new Date(earliestTask.startDate);
                          } else {
                            startDate = new Date(selectedProject.createdAt);
                          }
                          
                          const startDateStr = startDate.toISOString().split('T')[0];
                          const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
                          const localStartDate = new Date(startYear, startMonth - 1, startDay);
                          
                          if (selectedProject.endDate) {
                            const endDateObj = new Date(selectedProject.endDate);
                            const endDateStr = endDateObj.toISOString().split('T')[0];
                            const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);
                            const localEndDate = new Date(endYear, endMonth - 1, endDay);
                            return `${formatDate(localStartDate)} - ${formatDate(localEndDate)}`;
                          } else {
                            return `Created: ${formatDate(localStartDate)}`;
                          }
                        })()}
                      </span>
                    </div>
                    {selectedProject.assignedTo && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Assigned to: </span>
                        <span className="text-gray-900 dark:text-white">{selectedProject.assignedTo}</span>
                      </div>
                    )}
                    {selectedProject.estimatedHours && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Estimated Hours: </span>
                        <span className="text-gray-900 dark:text-white">{selectedProject.estimatedHours}h</span>
                      </div>
                    )}
                    {((selectedProject.urls && selectedProject.urls.length > 0) || selectedProject.url) && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">URLs: </span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {selectedProject.urls && selectedProject.urls.length > 0 ? (
                            selectedProject.urls.map((url, index) => (
                              <a
                                key={index}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {url}
                              </a>
                            ))
                          ) : (
                            selectedProject.url && (
                              <a
                                href={selectedProject.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {selectedProject.url}
                              </a>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <WireframeButton
                    projectId={selectedProject._id.toString()}
                    isManagerOrAdmin={currentUserRole === 'Administrator' || currentUserRole === 'Manager'}
                    onOpen={() => {
                      setWireframeProjectId(selectedProject._id.toString());
                      setShowWireframe(true);
                    }}
                  />
                  <Button variant="secondary" size="sm" onClick={() => handleEditProject(selectedProject)}>
                    Edit
                  </Button>
                </div>
              </div>

              {/* Project Assets by Type */}
              {(() => {
                const projectAssets = getProjectAssets(selectedProject._id.toString());
                const screenshots = getProjectAssetsByType(selectedProject._id.toString(), 'screenshot');
                const spreadsheets = getProjectAssetsByType(selectedProject._id.toString(), 'spreadsheet');
                const documents = getProjectAssetsByType(selectedProject._id.toString(), 'document');
                const links = getProjectAssetsByType(selectedProject._id.toString(), 'link');
                const otherAssets = projectAssets.filter(asset => 
                  !['screenshot', 'spreadsheet', 'document', 'link'].includes(asset.type)
                );

                return projectAssets.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-6">
                    {/* Screenshots */}
                    {screenshots.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Screenshots</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {screenshots.map((asset) => (
                            <div key={asset._id.toString()} className="relative">
                              {asset.fileUrl && (
                                <img
                                  src={asset.fileUrl}
                                  alt={asset.name}
                                  className="w-full h-32 object-cover rounded border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => window.open(asset.fileUrl, '_blank')}
                                />
                              )}
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">{asset.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Spreadsheets */}
                    {spreadsheets.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Spreadsheets</h3>
                        <div className="space-y-2">
                          {spreadsheets.map((asset) => (
                            <div 
                              key={asset._id.toString()} 
                              className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 ${asset.url ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors' : ''}`}
                              onClick={asset.url ? () => window.open(asset.url, '_blank') : undefined}
                            >
                              <div className="flex-1">
                                {asset.url ? (
                                  <a
                                    href={asset.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    {asset.name}
                                  </a>
                                ) : (
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{asset.name}</p>
                                )}
                                {asset.description && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{asset.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                {asset.url && (
                                  <a
                                    href={asset.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                                  >
                                    Open
                                  </a>
                                )}
                                {asset.fileUrl && (
                                  <a
                                    href={asset.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                                  >
                                    Download
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Documents */}
                    {documents.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Documents</h3>
                        <div className="space-y-2">
                          {documents.map((asset) => (
                            <div key={asset._id.toString()} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{asset.name}</p>
                                {asset.description && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{asset.description}</p>
                                )}
                              </div>
                              {asset.url && (
                                <a
                                  href={asset.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-4 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                                >
                                  Open
                                </a>
                              )}
                              {asset.fileUrl && (
                                <a
                                  href={asset.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-4 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                                >
                                  Download
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Links */}
                    {links.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Links</h3>
                        <div className="space-y-2">
                          {links.map((asset) => (
                            <div key={asset._id.toString()} className="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{asset.name}</p>
                              {asset.url && (
                                <a
                                  href={asset.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm break-all"
                                >
                                  {asset.url}
                                </a>
                              )}
                              {asset.description && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{asset.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Other Assets */}
                    {otherAssets.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Other Assets</h3>
                        <div className="space-y-2">
                          {otherAssets.map((asset) => (
                            <div key={asset._id.toString()} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 capitalize">
                                    {asset.type}
                                  </span>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{asset.name}</p>
                                </div>
                                {asset.description && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{asset.description}</p>
                                )}
                              </div>
                              {asset.url && (
                                <a
                                  href={asset.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-4 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                                >
                                  Open
                                </a>
                              )}
                              {asset.fileUrl && (
                                <a
                                  href={asset.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-4 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                                >
                                  Download
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </Card>

            {/* Active Tasks */}
            {activeTasks.length > 0 && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Active Tasks</h2>
                <div className="space-y-4">
                  {activeTasks.map((task, idx) => {
                    const originalTaskIndex = selectedProject.tasks?.findIndex(t => 
                      t.name === task.name && 
                      t.startDate.toString() === task.startDate.toString() &&
                      t.endDate.toString() === task.endDate.toString()
                    ) ?? -1;
                    const taskAssets = originalTaskIndex >= 0 ? getProjectAssets(selectedProject._id.toString(), originalTaskIndex) : [];
                    
                    return (
                      <div key={`active-task-${originalTaskIndex >= 0 ? originalTaskIndex : idx}-${task.name}`} className="pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-900 dark:text-white">{task.name}</h3>
                              <span className={`text-xs px-2 py-1 rounded ${
                                task.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                task.status === 'in-review' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                'bg-primary-light text-primary-dark'
                              }`}>
                                {task.status === 'active' ? 'Active' :
                                 task.status === 'in-review' ? 'In Review' :
                                 'Planning'}
                              </span>
                            </div>
                            {task.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{task.description}</p>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <span>{(() => {
                                // Parse date to avoid timezone issues - extract YYYY-MM-DD and create local date
                                const taskStartDateObj = new Date(task.startDate);
                                const taskStartDateStr = taskStartDateObj.toISOString().split('T')[0];
                                const [taskStartYear, taskStartMonth, taskStartDay] = taskStartDateStr.split('-').map(Number);
                                const localTaskStartDate = new Date(taskStartYear, taskStartMonth - 1, taskStartDay);
                                
                                const taskEndDateObj = new Date(task.endDate);
                                const taskEndDateStr = taskEndDateObj.toISOString().split('T')[0];
                                const [taskEndYear, taskEndMonth, taskEndDay] = taskEndDateStr.split('-').map(Number);
                                const localTaskEndDate = new Date(taskEndYear, taskEndMonth - 1, taskEndDay);
                                
                                return `${formatDate(localTaskStartDate)} - ${formatDate(localTaskEndDate)}`;
                              })()}</span>
                              {task.assignedTo && <span className="ml-4">Assigned to: {task.assignedTo}</span>}
                              {task.estimatedHours && <span className="ml-4">{task.estimatedHours}h</span>}
                            </div>
                          </div>
                          {(currentUserRole === 'Administrator' || currentUserRole === 'Manager') && (
                            <div className="ml-4 flex-shrink-0">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleEditProject(selectedProject)}
                                title="Edit task"
                              >
                                Edit
                              </Button>
                            </div>
                          )}
                        </div>
                        {taskAssets.length > 0 && (() => {
                              const taskScreenshots = taskAssets.filter(a => a.type === 'screenshot');
                              const taskSpreadsheets = taskAssets.filter(a => a.type === 'spreadsheet');
                              const taskDocuments = taskAssets.filter(a => a.type === 'document');
                              const taskLinks = taskAssets.filter(a => a.type === 'link');
                              const taskOther = taskAssets.filter(a => !['screenshot', 'spreadsheet', 'document', 'link'].includes(a.type));

                              return (
                                <div className="mt-3 space-y-3">
                                  {taskScreenshots.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Screenshots</h4>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {taskScreenshots.map((asset) => (
                                          <div key={asset._id.toString()} className="relative">
                                            {asset.fileUrl && (
                                              <img
                                                src={asset.fileUrl}
                                                alt={asset.name}
                                                className="w-full h-24 object-cover rounded border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => window.open(asset.fileUrl, '_blank')}
                                              />
                                            )}
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">{asset.name}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {taskSpreadsheets.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Spreadsheets</h4>
                                      <div className="space-y-1">
                                        {taskSpreadsheets.map((asset) => (
                                          <div 
                                            key={asset._id.toString()} 
                                            className={`flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 ${asset.url ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors' : ''}`}
                                            onClick={asset.url ? () => window.open(asset.url, '_blank') : undefined}
                                          >
                                            {asset.url ? (
                                              <a
                                                href={asset.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                              >
                                                {asset.name}
                                              </a>
                                            ) : (
                                              <p className="text-xs font-medium text-gray-900 dark:text-white">{asset.name}</p>
                                            )}
                                            <div className="flex items-center gap-2 ml-2">
                                              {asset.url && (
                                                <a 
                                                  href={asset.url} 
                                                  target="_blank" 
                                                  rel="noopener noreferrer" 
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                  Open
                                                </a>
                                              )}
                                              {asset.fileUrl && (
                                                <a 
                                                  href={asset.fileUrl} 
                                                  target="_blank" 
                                                  rel="noopener noreferrer" 
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                  Download
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {taskDocuments.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Documents</h4>
                                      <div className="space-y-1">
                                        {taskDocuments.map((asset) => (
                                          <div key={asset._id.toString()} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                            <p className="text-xs font-medium text-gray-900 dark:text-white">{asset.name}</p>
                                            {asset.url && (
                                              <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2">Open</a>
                                            )}
                                            {asset.fileUrl && (
                                              <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2">Download</a>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {taskLinks.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Links</h4>
                                      <div className="space-y-1">
                                        {taskLinks.map((asset) => (
                                          <div key={asset._id.toString()} className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                            <p className="text-xs font-medium text-gray-900 dark:text-white mb-1">{asset.name}</p>
                                            {asset.url && (
                                              <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all">{asset.url}</a>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {taskOther.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Other Assets</h4>
                                      <div className="space-y-1">
                                        {taskOther.map((asset) => (
                                          <div key={asset._id.toString()} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 capitalize">{asset.type}</span>
                                              <p className="text-xs font-medium text-gray-900 dark:text-white">{asset.name}</p>
                                            </div>
                                            {asset.url && (
                                              <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2">Open</a>
                                            )}
                                            {asset.fileUrl && (
                                              <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2">Download</a>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Completed Tasks</h2>
                <div className="space-y-4">
                  {completedTasks.map((task, idx) => {
                    const originalTaskIndex = selectedProject.tasks?.findIndex(t => 
                      t.name === task.name && 
                      t.startDate.toString() === task.startDate.toString() &&
                      t.endDate.toString() === task.endDate.toString()
                    ) ?? -1;
                    const taskAssets = originalTaskIndex >= 0 ? getProjectAssets(selectedProject._id.toString(), originalTaskIndex) : [];
                    
                    return (
                      <div key={`completed-task-${originalTaskIndex >= 0 ? originalTaskIndex : idx}-${task.name}`} className="pl-4 border-l-2 border-gray-200 dark:border-gray-700 opacity-75">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-900 dark:text-white line-through">{task.name}</h3>
                              <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                Complete
                              </span>
                            </div>
                            {task.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-through">{task.description}</p>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              <span>{(() => {
                                // Parse date to avoid timezone issues - extract YYYY-MM-DD and create local date
                                const taskStartDateObj = new Date(task.startDate);
                                const taskStartDateStr = taskStartDateObj.toISOString().split('T')[0];
                                const [taskStartYear, taskStartMonth, taskStartDay] = taskStartDateStr.split('-').map(Number);
                                const localTaskStartDate = new Date(taskStartYear, taskStartMonth - 1, taskStartDay);
                                
                                const taskEndDateObj = new Date(task.endDate);
                                const taskEndDateStr = taskEndDateObj.toISOString().split('T')[0];
                                const [taskEndYear, taskEndMonth, taskEndDay] = taskEndDateStr.split('-').map(Number);
                                const localTaskEndDate = new Date(taskEndYear, taskEndMonth - 1, taskEndDay);
                                
                                return `${formatDate(localTaskStartDate)} - ${formatDate(localTaskEndDate)}`;
                              })()}</span>
                              {task.assignedTo && <span className="ml-4">Assigned to: {task.assignedTo}</span>}
                              {task.estimatedHours && <span className="ml-4">{task.estimatedHours}h</span>}
                            </div>
                          </div>
                          {(currentUserRole === 'Administrator' || currentUserRole === 'Manager') && (
                            <div className="ml-4 flex-shrink-0">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleEditProject(selectedProject)}
                                title="Edit task"
                              >
                                Edit
                              </Button>
                            </div>
                          )}
                        </div>
                        {taskAssets.length > 0 && (() => {
                              const taskScreenshots = taskAssets.filter(a => a.type === 'screenshot');
                              const taskSpreadsheets = taskAssets.filter(a => a.type === 'spreadsheet');
                              const taskDocuments = taskAssets.filter(a => a.type === 'document');
                              const taskLinks = taskAssets.filter(a => a.type === 'link');
                              const taskOther = taskAssets.filter(a => !['screenshot', 'spreadsheet', 'document', 'link'].includes(a.type));

                              return (
                                <div className="mt-3 space-y-3 opacity-75">
                                  {taskScreenshots.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Screenshots</h4>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {taskScreenshots.map((asset) => (
                                          <div key={asset._id.toString()} className="relative">
                                            {asset.fileUrl && (
                                              <img
                                                src={asset.fileUrl}
                                                alt={asset.name}
                                                className="w-full h-24 object-cover rounded border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => window.open(asset.fileUrl, '_blank')}
                                              />
                                            )}
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">{asset.name}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {taskSpreadsheets.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Spreadsheets</h4>
                                      <div className="space-y-1">
                                        {taskSpreadsheets.map((asset) => (
                                          <div 
                                            key={asset._id.toString()} 
                                            className={`flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 ${asset.url ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors' : ''}`}
                                            onClick={asset.url ? () => window.open(asset.url, '_blank') : undefined}
                                          >
                                            {asset.url ? (
                                              <a
                                                href={asset.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                              >
                                                {asset.name}
                                              </a>
                                            ) : (
                                              <p className="text-xs font-medium text-gray-900 dark:text-white">{asset.name}</p>
                                            )}
                                            <div className="flex items-center gap-2 ml-2">
                                              {asset.url && (
                                                <a 
                                                  href={asset.url} 
                                                  target="_blank" 
                                                  rel="noopener noreferrer" 
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                  Open
                                                </a>
                                              )}
                                              {asset.fileUrl && (
                                                <a 
                                                  href={asset.fileUrl} 
                                                  target="_blank" 
                                                  rel="noopener noreferrer" 
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                  Download
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {taskDocuments.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Documents</h4>
                                      <div className="space-y-1">
                                        {taskDocuments.map((asset) => (
                                          <div key={asset._id.toString()} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                            <p className="text-xs font-medium text-gray-900 dark:text-white">{asset.name}</p>
                                            {asset.url && (
                                              <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2">Open</a>
                                            )}
                                            {asset.fileUrl && (
                                              <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2">Download</a>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {taskLinks.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Links</h4>
                                      <div className="space-y-1">
                                        {taskLinks.map((asset) => (
                                          <div key={asset._id.toString()} className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                            <p className="text-xs font-medium text-gray-900 dark:text-white mb-1">{asset.name}</p>
                                            {asset.url && (
                                              <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all">{asset.url}</a>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {taskOther.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Other Assets</h4>
                                      <div className="space-y-1">
                                        {taskOther.map((asset) => (
                                          <div key={asset._id.toString()} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 capitalize">{asset.type}</span>
                                              <p className="text-xs font-medium text-gray-900 dark:text-white">{asset.name}</p>
                                            </div>
                                            {asset.url && (
                                              <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2">Open</a>
                                            )}
                                            {asset.fileUrl && (
                                              <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2">Download</a>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {activeTasks.length === 0 && completedTasks.length === 0 && (
              <Card className="p-6">
                <p className="text-gray-500 dark:text-gray-400 text-center">No tasks for this project.</p>
              </Card>
            )}

            {/* Employee Utilization Overview */}
            {employeeUtilization.length > 0 && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Employee Utilization</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {employeeUtilization.map((util) => {
                    const employee = employees.find(emp => emp.name === util.name);
                    return (
                      <Card key={util.name} className="p-4">
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-gray-900 dark:text-white">{util.name}</h4>
                            {employee && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                employee.role === 'Administrator' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                employee.role === 'Manager' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                              }`}>
                                {employee.role}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          {util.projectHours > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Project Hours:</span>
                              <span className="font-medium text-orange-600 dark:text-orange-400">{util.projectHours}h</span>
                            </div>
                          )}
                          {util.taskHours > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Task Hours:</span>
                              <span className="font-medium text-orange-600 dark:text-orange-400">{util.taskHours}h</span>
                            </div>
                          )}
                          {util.completedHours > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600 dark:text-gray-400">Completed:</span>
                              <span className="font-medium text-green-600 dark:text-green-400">{util.completedHours}h</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span className="font-medium text-gray-900 dark:text-white">Total:</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{util.totalHours}h</span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-gray-300 mb-4">No projects found.</p>
            <Button onClick={handleCreateProject}>Create Your First Project</Button>
          </Card>
        )}

        {/* Project Form Modal */}
        <Modal isOpen={showProjectForm} onClose={() => setShowProjectForm(false)}>
          <ProjectForm
            project={editingProject}
            onSubmit={handleSubmitProject}
            onCancel={() => setShowProjectForm(false)}
            userRole={currentUserRole}
          />
        </Modal>

        {/* Wireframe Viewer */}
        {showWireframe && wireframeProjectId && (
          <WireframeViewer
            projectId={wireframeProjectId}
            isManagerOrAdmin={currentUserRole === 'Administrator' || currentUserRole === 'Manager'}
            onClose={() => {
              setShowWireframe(false);
              setWireframeProjectId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
