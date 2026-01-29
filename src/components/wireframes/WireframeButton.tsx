'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { IWireframe } from '@/lib/models/Wireframe';

interface WireframeButtonProps {
  projectId: string;
  isManagerOrAdmin: boolean;
  onOpen: () => void;
}

export default function WireframeButton({ projectId, isManagerOrAdmin, onOpen }: WireframeButtonProps) {
  const [hasWireframe, setHasWireframe] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkWireframe = async () => {
      try {
        const response = await fetch(`/api/wireframes?projectId=${projectId}`);
        if (response.ok) {
          const wireframe = await response.json();
          setHasWireframe(!!wireframe);
        }
      } catch (error) {
        // Error checking wireframe - assume none exists
        setHasWireframe(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkWireframe();
  }, [projectId]);

  if (isLoading) {
    return null;
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onOpen}
      className="relative"
    >
      {hasWireframe ? (
        <>
          <span>View Site Structure</span>
          <span className="ml-2 w-2 h-2 bg-green-500 rounded-full inline-block" />
        </>
      ) : (
        <>
          <span>Add Site Structure</span>
        </>
      )}
    </Button>
  );
}
