'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { IProject } from '@/lib/models/Project';
import { IClient } from '@/lib/models/Client';
import { IEmployee } from '@/lib/models/Employee';
import ContentItemCreateForm from '@/components/planning-map/ContentItemCreateForm';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';

interface ContentItemCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: IProject | null;
  defaultPublishDate?: Date;
  initialTitle?: string;
  initialChannel?: string;
  initialNotes?: string;
  employees: IEmployee[];
  clients?: IClient[];
  isManagerOrAdmin?: boolean;
  onSuccess: () => void;
}

export default function ContentItemCreateModal({
  isOpen,
  onClose,
  project,
  defaultPublishDate,
  initialTitle,
  initialChannel,
  initialNotes,
  employees,
  clients = [],
  isManagerOrAdmin = true,
  onSuccess,
}: ContentItemCreateModalProps) {
  const light = useInspectorLight();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!mounted || !isOpen || !project) return null;

  const handleSuccess = () => {
    onSuccess();
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col rounded-xl shadow-xl ${lightSurface('bg-white', 'dark:bg-gray-800', light)}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between p-4 border-b shrink-0 ${lightSurface('border-gray-200', 'dark:border-gray-700', light)}`}>
          <h3 className={`text-lg font-semibold ${lightSurface('text-gray-900', 'dark:text-white', light)}`}>
            Add Content
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={`text-gray-500 hover:text-gray-700 p-1 ${lightSurface('', 'dark:hover:text-gray-300', light)}`}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex-1 min-h-0">
          <ContentItemCreateForm
            project={project}
            clients={clients}
            employees={employees}
            isManagerOrAdmin={isManagerOrAdmin}
            defaultPublishDate={defaultPublishDate}
            initialTitle={initialTitle}
            initialChannel={initialChannel}
            initialNotes={initialNotes}
            active={isOpen}
            onCancel={onClose}
            onSuccess={handleSuccess}
            nestedInModal
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
