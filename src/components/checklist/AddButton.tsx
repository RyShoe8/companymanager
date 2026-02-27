'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import CategoryModal from './CategoryModal';

interface AddButtonProps {
  projectId: string;
  phase: 'Plan' | 'Build' | 'Run';
  projectType: string;
  isManagerOrAdmin: boolean;
  onAddButton: (label: string, url: string) => Promise<void>;
}

export default function AddButton({ projectId, phase, projectType, isManagerOrAdmin, onAddButton }: AddButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setShowModal(true)}>
        Add
      </Button>
      {showModal && (
        <CategoryModal
          phase={phase}
          projectType={projectType}
          isManagerOrAdmin={isManagerOrAdmin}
          onClose={() => setShowModal(false)}
          onAddButton={onAddButton}
        />
      )}
    </>
  );
}
