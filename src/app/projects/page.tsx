'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IProject } from '@/lib/models/Project';
import { IAsset } from '@/lib/models/Asset';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Toggle from '@/components/ui/Toggle';
import ProjectForm from '@/components/planning-map/ProjectForm';
import { TimeframeType } from '@/lib/utils/dateUtils';
import { IEmployee } from '@/lib/models/Employee';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<IProject[]>([]);
  const [assets, setAssets] = useState<IAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<IProject | undefined>();
  const [uploadingAsset, setUploadingAsset] = useState<{ projectId: string; stageIndex?: number } | null>(null);
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(false);
  const [currentUserEmployeeName, setCurrentUserEmployeeName] = useState<string | null>(null);
  const [employees, setEmployees] = useState<IEmployee[]>([]);

  useEffect(() => {
    loadData();
  }, []);

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

      // Get current user's employee name
      try {
        const userResponse = await fetch('/api/auth/me');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          const currentEmployee = employeesData.find((emp: IEmployee) => emp.userId?.toString() === userData.id);
          setCurrentUserEmployeeName(currentEmployee?.name || null);
        }
      } catch (error) {
        console.error('Error loading current user:', error);
      }

      setProjects(projectsData);
      setAssets(assetsData);
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

  const handleSubmitProject = async (data: Partial<IProject>) => {
    try {
      const url = editingProject ? `/api/projects/${editingProject._id}` : '/api/projects';
      const method = editingProject ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, timeframeType: 'monthly' }),
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

  const handleUploadAsset = (projectId: string, stageIndex?: number) => {
    setUploadingAsset({ projectId, stageIndex });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !uploadingAsset) return;

    const uploadPromises = Array.from(files).map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      formData.append('linkedProjectId', uploadingAsset.projectId);
      if (uploadingAsset.stageIndex !== undefined) {
        formData.append('linkedProjectStageIndex', uploadingAsset.stageIndex.toString());
      }

      try {
        const response = await fetch('/api/assets/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
        return response.json();
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        throw error;
      }
    });

    try {
      await Promise.all(uploadPromises);
      setUploadingAsset(null);
      loadData();
    } catch (error) {
      console.error('Error uploading files:', error);
      // Still reload to show successfully uploaded files
      loadData();
    }
  };

  const getProjectAssets = (projectId: string, stageIndex?: number) => {
    return assets.filter((asset) => {
      if (asset.linkedProjectId?.toString() !== projectId) return false;
      if (stageIndex !== undefined) {
        return asset.linkedProjectStageIndex === stageIndex;
      }
      return asset.linkedProjectStageIndex === undefined;
    });
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 px-[100px] max-md:px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 px-[100px] max-md:px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-white">Projects</h1>
            {currentUserEmployeeName && (
              <Toggle
                label="Show only my assignments"
                checked={showOnlyAssigned}
                onChange={setShowOnlyAssigned}
              />
            )}
          </div>
          <Button onClick={handleCreateProject}>+ New Project</Button>
        </div>

        {(showOnlyAssigned && currentUserEmployeeName
          ? projects.filter(p => 
              p.assignedTo === currentUserEmployeeName || 
              p.stages?.some(s => s.assignedTo === currentUserEmployeeName)
            )
          : projects
        ).length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-300 mb-4">No active projects found.</p>
            <Button onClick={handleCreateProject}>Create Your First Project</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {(showOnlyAssigned && currentUserEmployeeName
              ? projects.filter(p => 
                  p.assignedTo === currentUserEmployeeName || 
                  p.stages?.some(s => s.assignedTo === currentUserEmployeeName)
                )
              : projects
            ).map((project) => {
              const projectAssets = getProjectAssets(project._id.toString());
              return (
                <Card key={project._id.toString()} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {project.name}
                        </h2>
                        <span className={`text-xs px-2 py-1 rounded ${
                          project.status === 'in-development' ? 'bg-green-100 text-green-800' :
                          project.status === 'in-review' ? 'bg-yellow-100 text-yellow-800' :
                          project.status === 'launched' ? 'bg-gray-100 text-gray-600' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {project.status}
                        </span>
                      </div>
                      {project.description && (
                        <p className="text-gray-600 dark:text-gray-400 mb-2">{project.description}</p>
                      )}
                      {((project.urls && project.urls.length > 0) || project.url) && (
                        <div className="space-y-1">
                          {project.urls && project.urls.length > 0 ? (
                            project.urls.map((url, index) => (
                              <div key={index}>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  {url}
                                </a>
                              </div>
                            ))
                          ) : (
                            project.url && (
                              <a
                                href={project.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {project.url}
                              </a>
                            )
                          )}
                        </div>
                      )}
                      <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>{formatDate(project.startDate)} - {formatDate(project.endDate)}</span>
                        {project.assignedTo && <span className="ml-4">Assigned to: {project.assignedTo}</span>}
                        {project.estimatedHours && <span className="ml-4">{project.estimatedHours}h</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => handleEditProject(project)}>
                        Edit
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleUploadAsset(project._id.toString())}>
                        Upload Screenshot
                      </Button>
                    </div>
                  </div>

                  {projectAssets.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Screenshots:</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {projectAssets.map((asset) => (
                          <div key={asset._id.toString()} className="relative">
                            {asset.fileUrl && (
                              <img
                                src={asset.fileUrl}
                                alt={asset.name}
                                className="w-full h-32 object-cover rounded border border-gray-200 dark:border-gray-700"
                              />
                            )}
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">{asset.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {project.stages && project.stages.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stages:</h3>
                      <div className="space-y-3">
                        {project.stages.map((stage, index) => {
                          const stageAssets = getProjectAssets(project._id.toString(), index);
                          return (
                            <div key={index} className="pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium text-gray-900 dark:text-white">{stage.name}</h4>
                                  {stage.description && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{stage.description}</p>
                                  )}
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    <span>{formatDate(stage.startDate)} - {formatDate(stage.endDate)}</span>
                                    {stage.assignedTo && <span className="ml-4">Assigned to: {stage.assignedTo}</span>}
                                    {stage.estimatedHours && <span className="ml-4">{stage.estimatedHours}h</span>}
                                  </div>
                                </div>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleUploadAsset(project._id.toString(), index)}
                                >
                                  Upload Screenshot
                                </Button>
                              </div>
                              {stageAssets.length > 0 && (
                                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {stageAssets.map((asset) => (
                                    <div key={asset._id.toString()} className="relative">
                                      {asset.fileUrl && (
                                        <img
                                          src={asset.fileUrl}
                                          alt={asset.name}
                                          className="w-full h-24 object-cover rounded border border-gray-200 dark:border-gray-700"
                                        />
                                      )}
                                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">{asset.name}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Project Form Modal */}
        <Modal isOpen={showProjectForm} onClose={() => setShowProjectForm(false)}>
          <ProjectForm
            project={editingProject}
            timeframeType="monthly"
            onSubmit={handleSubmitProject}
            onCancel={() => setShowProjectForm(false)}
          />
        </Modal>

        {/* File Upload Modal */}
        <Modal isOpen={uploadingAsset !== null} onClose={() => setUploadingAsset(null)}>
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Upload Screenshots</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select one or more images to upload
            </p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                dark:file:bg-blue-900 dark:file:text-blue-300"
            />
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setUploadingAsset(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
