'use client';

import Modal from '@/components/ui/Modal';
import { IProject } from '@/lib/models/Project';
import { filterContributableProjects } from '@/lib/utils/projectTeam';

interface SelectProjectModalProps {
  isOpen: boolean;
  title: string;
  projects: IProject[];
  currentUserEmployeeId?: string | null;
  isManagerOrAdmin: boolean;
  onSelect: (project: IProject) => void;
  onClose: () => void;
}

export default function SelectProjectModal({
  isOpen,
  title,
  projects,
  currentUserEmployeeId,
  isManagerOrAdmin,
  onSelect,
  onClose,
}: SelectProjectModalProps) {
  const eligible = filterContributableProjects(projects, currentUserEmployeeId ?? null, isManagerOrAdmin);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      {eligible.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No projects available. You need to be assigned to a project to continue.
        </p>
      ) : (
        <ul className="divide-y divide-border max-h-[min(60vh,420px)] overflow-y-auto -mx-1">
          {eligible.map((project) => (
            <li key={project._id.toString()}>
              <button
                type="button"
                onClick={() => onSelect(project)}
                className="w-full text-left px-3 py-3 flex items-center gap-3 rounded-lg hover:bg-background-elevated transition-colors"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.color || '#3b82f6' }}
                />
                <span className="font-medium text-text-primary truncate">{project.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
