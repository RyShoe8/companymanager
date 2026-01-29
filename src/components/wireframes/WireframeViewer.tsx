'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IWireframe } from '@/lib/models/Wireframe';
import WireframeBuilder from './WireframeBuilder';
import ExternalWireframeForm from './ExternalWireframeForm';
import BottomSheet from '@/components/ui/BottomSheet';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import useIsMobile from '@/lib/hooks/useIsMobile';

interface WireframeViewerProps {
  projectId: string;
  isManagerOrAdmin: boolean;
  onClose: () => void;
}

export default function WireframeViewer({ projectId, isManagerOrAdmin, onClose }: WireframeViewerProps) {
  const isMobile = useIsMobile();
  const [wireframe, setWireframe] = useState<IWireframe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [projectLogo, setProjectLogo] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadWireframe();
    loadProjectLogo();
  }, [projectId]);

  const loadProjectLogo = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const project = await response.json();
        setProjectLogo(project.logo);
      }
    } catch (error) {
      console.error('Error loading project logo:', error);
    }
  };

  const loadWireframe = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/wireframes?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setWireframe(data);
        } else {
          // No wireframe exists - show choice modal if user can edit, otherwise show message
          if (isManagerOrAdmin) {
            setShowChoiceModal(true);
          }
        }
      }
    } catch (error) {
      console.error('Error loading wireframe:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBuiltin = async () => {
    setShowChoiceModal(false);
    try {
      const response = await fetch('/api/wireframes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sourceType: 'builtin',
          pages: [],
          connections: [],
        }),
      });

      if (response.ok) {
        const newWireframe = await response.json();
        setWireframe(newWireframe);
        setIsEditMode(true);
      } else {
        alert('Failed to create site structure');
      }
    } catch (error) {
      console.error('Error creating site structure:', error);
      alert('Failed to create site structure');
    }
  };

  const handleCreateExternal = () => {
    setShowChoiceModal(false);
    setShowExternalForm(true);
  };

  const handleExternalSubmit = async (url: string) => {
    try {
      const response = await fetch('/api/wireframes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sourceType: 'external',
          externalUrl: url,
          pages: [],
          connections: [],
        }),
      });

      if (response.ok) {
        const newWireframe = await response.json();
        setWireframe(newWireframe);
        setShowExternalForm(false);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save site structure link');
      }
    } catch (error) {
      console.error('Error saving external site structure:', error);
      alert('Failed to save site structure link');
    }
  };

  const handleUpdateExternal = async (url: string) => {
    if (!wireframe) return;

    try {
      const response = await fetch(`/api/wireframes/${wireframe._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalUrl: url,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setWireframe(updated);
        setShowExternalForm(false);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update site structure link');
      }
    } catch (error) {
      console.error('Error updating external site structure:', error);
      alert('Failed to update site structure link');
    }
  };

  const handleSave = async (updates: Partial<IWireframe>) => {
    if (!wireframe) return;

    try {
      const response = await fetch(`/api/wireframes/${wireframe._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updated = await response.json();
        console.log('[WireframeViewer] Saved wireframe response:', updated);
        console.log('[WireframeViewer] Pages with positions:', updated.pages?.map((p: any) => ({ id: p.id, name: p.name, x: p.x, y: p.y })));
        // Update wireframe state with the saved data (which includes x/y positions)
        // Don't reload immediately - let the updated wireframe prop update the component
        setWireframe(updated);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save' }));
        throw new Error(errorData.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Error saving site structure:', error);
      throw error;
    }
  };

  const detectToolName = (url: string): string => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('figma.com')) return 'Figma';
    if (lowerUrl.includes('miro.com')) return 'Miro';
    if (lowerUrl.includes('whimsical.com')) return 'Whimsical';
    if (lowerUrl.includes('balsamiq.com')) return 'Balsamiq';
    if (lowerUrl.includes('sketch.com')) return 'Sketch';
    if (lowerUrl.includes('invisionapp.com') || lowerUrl.includes('invision.com')) return 'InVision';
    return 'External Tool';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500 dark:text-gray-400">Loading site structure...</div>
      </div>
    );
  }

  // Show choice modal if no wireframe exists and user can edit
  if (showChoiceModal) {
    const ChoiceContent = () => (
      <div className="p-6 space-y-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Create Wireframe
        </h3>
        <div className="space-y-3">
          <Button
            onClick={handleCreateBuiltin}
            className="w-full justify-start text-left h-auto py-4"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎨</span>
              <div>
                <div className="font-semibold">Build with our tool</div>
                <div className="text-sm opacity-80">Create site structure and layouts</div>
              </div>
            </div>
          </Button>
          <Button
            variant="secondary"
            onClick={handleCreateExternal}
            className="w-full justify-start text-left h-auto py-4"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔗</span>
              <div>
                <div className="font-semibold">Link external tool</div>
                <div className="text-sm opacity-80">Use Figma, Miro, or another tool</div>
              </div>
            </div>
          </Button>
        </div>
        <div className="pt-4">
          <Button variant="secondary" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    );

    const choiceModal = isMobile ? (
      <BottomSheet isOpen={true} onClose={onClose} title="Create Site Structure">
        <ChoiceContent />
      </BottomSheet>
    ) : (
      <Modal isOpen={true} onClose={onClose} title="Create Site Structure">
        <ChoiceContent />
      </Modal>
    );

    // Render to document.body to escape any parent modal constraints
    if (typeof window !== 'undefined') {
      return createPortal(choiceModal, document.body);
    }
    return choiceModal;
  }

  // Show external form
  if (showExternalForm) {
    const externalFormModal = isMobile ? (
          <BottomSheet isOpen={true} onClose={() => setShowExternalForm(false)} title="Link External Site Structure">
        <div className="p-4">
          <ExternalWireframeForm
            projectId={projectId}
            onSubmit={wireframe ? handleUpdateExternal : handleExternalSubmit}
            onCancel={() => {
              setShowExternalForm(false);
              if (!wireframe) {
                setShowChoiceModal(true);
              }
            }}
            existingUrl={wireframe?.externalUrl}
          />
        </div>
      </BottomSheet>
    ) : (
      <Modal isOpen={true} onClose={() => setShowExternalForm(false)} title="Link External Site Structure">
        <div className="p-6">
          <ExternalWireframeForm
            projectId={projectId}
            onSubmit={wireframe ? handleUpdateExternal : handleExternalSubmit}
            onCancel={() => {
              setShowExternalForm(false);
              if (!wireframe) {
                setShowChoiceModal(true);
              }
            }}
            existingUrl={wireframe?.externalUrl}
          />
        </div>
      </Modal>
    );

    // Render to document.body to escape any parent modal constraints
    if (typeof window !== 'undefined') {
      return createPortal(externalFormModal, document.body);
    }
    return externalFormModal;
  }

  // Show external wireframe view
  if (wireframe && wireframe.sourceType === 'external') {
    const toolName = wireframe.externalUrl ? detectToolName(wireframe.externalUrl) : 'External Tool';
    
    const externalViewModal = isMobile ? (
          <BottomSheet isOpen={true} onClose={onClose} title="Site Structure" maxHeight="90vh">
            <div className="p-4 space-y-4">
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🔗</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  External Site Structure
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  This site structure is managed in {toolName}
                </p>
            <a
              href={wireframe.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button>
                Open in {toolName}
              </Button>
            </a>
          </div>
          {isManagerOrAdmin && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="secondary"
                onClick={() => setShowExternalForm(true)}
                className="w-full"
              >
                Update Link
              </Button>
            </div>
          )}
        </div>
      </BottomSheet>
    ) : (
          <Modal isOpen={true} onClose={onClose} title="Site Structure" maxWidth="lg">
            <div className="p-6 space-y-4">
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🔗</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  External Site Structure
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  This site structure is managed in {toolName}
                </p>
            <a
              href={wireframe.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button>
                Open in {toolName}
              </Button>
            </a>
          </div>
          {isManagerOrAdmin && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="secondary"
                onClick={() => setShowExternalForm(true)}
                className="w-full"
              >
                Update Link
              </Button>
            </div>
          )}
        </div>
      </Modal>
    );

    // Render to document.body to escape any parent modal constraints
    if (typeof window !== 'undefined') {
      return createPortal(externalViewModal, document.body);
    }
    return externalViewModal;
  }

  // Show message if no wireframe exists and user can't edit
  if (!wireframe && !isManagerOrAdmin && !showChoiceModal && !showExternalForm) {
    const noWireframeModal = isMobile ? (
      <BottomSheet isOpen={true} onClose={onClose} title="Site Structure">
          <div className="p-4 text-center py-8">
            <div className="text-4xl mb-4">📐</div>
            <p className="text-gray-600 dark:text-gray-400">
              No site structure has been created for this project yet.
            </p>
          </div>
        </BottomSheet>
    ) : (
      <Modal isOpen={true} onClose={onClose} title="Site Structure">
        <div className="p-6 text-center py-8">
          <div className="text-4xl mb-4">📐</div>
          <p className="text-gray-600 dark:text-gray-400">
            No site structure has been created for this project yet.
          </p>
        </div>
      </Modal>
    );

    // Render to document.body to escape any parent modal constraints
    if (typeof window !== 'undefined') {
      return createPortal(noWireframeModal, document.body);
    }
    return noWireframeModal;
  }

  // Show built-in wireframe builder
  if (wireframe && wireframe.sourceType === 'builtin') {
    const wireframeContent = isMobile ? (
      <BottomSheet isOpen={true} onClose={onClose} title="Site Structure" maxHeight="100vh" hideCloseButton={isEditMode}>
        <div className="h-[90vh]">
          <WireframeBuilder
            wireframe={wireframe}
            projectId={projectId}
            projectLogo={projectLogo}
            onSave={handleSave}
            onClose={onClose}
            isEditMode={isEditMode}
            onToggleEditMode={() => setIsEditMode(!isEditMode)}
          />
        </div>
      </BottomSheet>
    ) : (
      <Modal isOpen={true} onClose={onClose} title="Site Structure" maxWidth="full" hideCloseButton={isEditMode}>
        <WireframeBuilder
          wireframe={wireframe}
          projectId={projectId}
          projectLogo={projectLogo}
          onSave={handleSave}
          onClose={onClose}
          isEditMode={isEditMode}
          onToggleEditMode={() => setIsEditMode(!isEditMode)}
        />
      </Modal>
    );

    // Render to document.body to escape any parent modal constraints
    if (typeof window !== 'undefined') {
      return createPortal(wireframeContent, document.body);
    }
    return wireframeContent;
  }

  return null;
}
