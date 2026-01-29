'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { IWireframe, IWireframePage, IWireframeSection, IWireframeComponent, IWireframeConnection, SectionType, ComponentType } from '@/lib/models/Wireframe';
import SiteStructureCanvas from './SiteStructureCanvas';
import WireframeCanvas from './WireframeCanvas';
import SectionPalette from './SectionPalette';
import ComponentPaletteDropdown from './ComponentPaletteDropdown';
import SectionComponentPalette from './SectionComponentPalette';
import ComponentProperties from './ComponentProperties';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import useIsMobile from '@/lib/hooks/useIsMobile';
import Modal from '@/components/ui/Modal';

interface WireframeBuilderProps {
  wireframe: IWireframe | null;
  projectId: string;
  projectLogo?: string;
  onSave: (wireframe: Partial<IWireframe>) => Promise<void>;
  onClose: () => void;
  isEditMode: boolean;
  onToggleEditMode: () => void;
}

type ViewMode = 'structure' | 'wireframe';

export default function WireframeBuilder({
  wireframe,
  projectId,
  projectLogo,
  onSave,
  onClose,
  isEditMode,
  onToggleEditMode,
}: WireframeBuilderProps) {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>('structure');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  
  // Debug: Log when selectedSectionId changes
  useEffect(() => {
    console.log('[WireframeBuilder] selectedSectionId changed to:', selectedSectionId);
  }, [selectedSectionId]);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [pages, setPages] = useState<IWireframePage[]>(wireframe?.pages || []);
  const [connections, setConnections] = useState<IWireframeConnection[]>(wireframe?.connections || []);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pagePositions, setPagePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [propertiesOpen, setPropertiesOpen] = useState(!isMobile && (!!selectedSectionId || !!selectedComponentId));
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [pageEditName, setPageEditName] = useState('');
  const [pageEditPath, setPageEditPath] = useState('');

  const currentPage = pages.find(p => p.id === selectedPageId);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onSaveRef = useRef(onSave);
  const isSavingRef = useRef(false);
  const prevPagesRef = useRef<string>('');
  const prevConnectionsRef = useRef<string>('');
  const prevSelectedSectionIdRef = useRef<string | null>(null);

  // Keep onSave ref updated
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (wireframe) {
      console.log('[WireframeBuilder] Wireframe updated:', { 
        id: wireframe._id, 
        updatedAt: wireframe.updatedAt,
        pages: wireframe.pages?.map(p => ({ id: p.id, name: p.name, x: p.x, y: p.y }))
      });
      const previousPages = pages;
      setPages(wireframe.pages || []);
      setConnections(wireframe.connections || []);
      // Store initial state for comparison
      prevPagesRef.current = JSON.stringify(wireframe.pages || []);
      prevConnectionsRef.current = JSON.stringify(wireframe.connections || []);
      // Reset unsaved changes flag when wireframe loads
      setHasUnsavedChanges(false);
      // Auto-select first page if none selected
      if (!selectedPageId && wireframe.pages && wireframe.pages.length > 0) {
        setSelectedPageId(wireframe.pages[0].id);
      }
      // Preserve selectedSectionId if the section still exists after update
      // Use ref to track previous selection to avoid clearing it unnecessarily
      const previousSelection = prevSelectedSectionIdRef.current || selectedSectionId;
      if (previousSelection) {
        const currentPage = wireframe.pages?.find(p => p.id === selectedPageId);
        const sectionStillExists = currentPage?.sections?.some(s => s.id === previousSelection);
        if (!sectionStillExists) {
          console.log('[WireframeBuilder] Selected section no longer exists, clearing selection');
          setSelectedSectionId(null);
          prevSelectedSectionIdRef.current = null;
        } else {
          console.log('[WireframeBuilder] Preserving selectedSectionId:', previousSelection);
          // Restore selection if it was cleared
          if (selectedSectionId !== previousSelection) {
            console.log('[WireframeBuilder] Restoring selectedSectionId from', selectedSectionId, 'to', previousSelection);
            setSelectedSectionId(previousSelection);
          }
          prevSelectedSectionIdRef.current = previousSelection;
        }
      }
      // Mark initial load as complete after a short delay
      const timer = setTimeout(() => setIsInitialLoad(false), 500);
      return () => clearTimeout(timer);
    } else {
      setPages([]);
      setConnections([]);
      prevPagesRef.current = '';
      prevConnectionsRef.current = '';
      setHasUnsavedChanges(false);
      setIsInitialLoad(false);
    }
  }, [wireframe?._id, wireframe?.updatedAt, selectedPageId]);

  // Track unsaved changes - this is a backup check, but we primarily rely on manual flags
  useEffect(() => {
    if (!isInitialLoad && wireframe) {
      const currentPagesStr = JSON.stringify(pages);
      const currentConnectionsStr = JSON.stringify(connections);
      
      const hasChanges = 
        currentPagesStr !== prevPagesRef.current ||
        currentConnectionsStr !== prevConnectionsRef.current;
      
      // Only update if there are actual changes (don't override manual false)
      if (hasChanges) {
        setHasUnsavedChanges(true);
      }
    }
    // Don't update refs here - they should only be updated after save or on initial load
  }, [pages, connections, wireframe, isInitialLoad]);

  const handlePageAdd = () => {
    const newPage: IWireframePage = {
      id: `page-${Date.now()}`,
      name: `Page ${pages.length + 1}`,
      path: `/page-${pages.length + 1}`,
      sections: [],
    };
    setPages([...pages, newPage]);
    setSelectedPageId(newPage.id);
    setHasUnsavedChanges(true);
  };

  const handlePageUpdate = (pageId: string, updates: Partial<IWireframePage>) => {
    const updatedPages = pages.map(p => p.id === pageId ? { ...p, ...updates } : p);
    console.log('[WireframeBuilder] handlePageUpdate:', { pageId, updates, updatedPage: updatedPages.find(p => p.id === pageId) });
    setPages(updatedPages);
    // Immediately mark as having unsaved changes
    setHasUnsavedChanges(true);
  };

  const handlePageEdit = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    if (page) {
      setEditingPageId(pageId);
      setPageEditName(page.name);
      setPageEditPath(page.path);
    }
  };

  const handlePageEditSave = () => {
    if (editingPageId && pageEditName.trim()) {
      handlePageUpdate(editingPageId, {
        name: pageEditName.trim(),
        path: pageEditPath.trim() || `/${pageEditName.trim().toLowerCase().replace(/\s+/g, '-')}`,
      });
      setEditingPageId(null);
      setPageEditName('');
      setPageEditPath('');
    }
  };

  const handlePageEditCancel = () => {
    setEditingPageId(null);
    setPageEditName('');
    setPageEditPath('');
  };

  const handlePageDelete = (pageId: string) => {
    setPages(pages.filter(p => p.id !== pageId));
    setConnections(connections.filter(c => c.fromPageId !== pageId && c.toPageId !== pageId));
    setHasUnsavedChanges(true);
    if (selectedPageId === pageId) {
      setSelectedPageId(pages.length > 1 ? pages.find(p => p.id !== pageId)?.id || null : null);
    }
  };

  const handleConnectionAdd = (fromPageId: string, toPageId: string) => {
    const exists = connections.some(c => c.fromPageId === fromPageId && c.toPageId === toPageId);
    if (!exists) {
      setConnections([...connections, { fromPageId, toPageId }]);
      setHasUnsavedChanges(true);
    }
  };

  const handleConnectionDelete = (fromPageId: string, toPageId: string) => {
    setConnections(connections.filter(c => !(c.fromPageId === fromPageId && c.toPageId === toPageId)));
    setHasUnsavedChanges(true);
  };

  const handleSectionSelect = (type: SectionType) => {
    if (!selectedPageId) {
      if (pages.length === 0) {
        handlePageAdd();
      } else {
        setSelectedPageId(pages[0].id);
        setViewMode('wireframe');
      }
      return;
    }
    
    const snapToGrid = (value: number): number => {
      const GRID_SIZE = 20;
      return Math.round(value / GRID_SIZE) * GRID_SIZE;
    };
    
    const defaultSizes: Record<SectionType, { width: number; height: number }> = {
      header: { width: 1200, height: 80 },
      footer: { width: 1200, height: 100 },
      nav: { width: 1200, height: 60 },
      content: { width: 1200, height: 400 },
    };

    const size = defaultSizes[type] || { width: 1200, height: 200 };
    const newSection: IWireframeSection = {
      id: `section-${Date.now()}`,
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
      x: snapToGrid(0),
      y: snapToGrid(0),
      width: snapToGrid(size.width),
      height: snapToGrid(size.height),
      components: [],
    };
    
    const updatedPages = pages.map(p => 
      p.id === selectedPageId 
        ? { ...p, sections: [...(p.sections || []), newSection] }
        : p
    );
    setPages(updatedPages);
    setSelectedSectionId(newSection.id);
    setHasUnsavedChanges(true);
  };

  const handleSectionUpdate = (sectionId: string, updates: Partial<IWireframeSection>) => {
    if (!selectedPageId) return;
    const updatedPages = pages.map(p => 
      p.id === selectedPageId 
        ? {
            ...p,
            sections: (p.sections || []).map(s =>
              s.id === sectionId ? { ...s, ...updates } : s
            ),
          }
        : p
    );
    setPages(updatedPages);
    setHasUnsavedChanges(true);
    // Preserve selection when updating section
    if (selectedSectionId === sectionId) {
      // Selection is already correct, no need to change it
      console.log('[WireframeBuilder] handleSectionUpdate preserving selection:', sectionId);
    }
  };

  const handleSectionDelete = (sectionId: string) => {
    if (!selectedPageId) return;
    const updatedPages = pages.map(p =>
      p.id === selectedPageId
        ? { ...p, sections: (p.sections || []).filter(s => s.id !== sectionId) }
        : p
    );
    setPages(updatedPages);
    setHasUnsavedChanges(true);
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null);
    }
  };

  const handleComponentAdd = (component: Omit<IWireframeComponent, 'id'>, x: number, y: number) => {
    if (!selectedPageId) return;
    const newComponent: IWireframeComponent = {
      ...component,
      id: `comp-${Date.now()}`,
    };
    
    const updatedPages = pages.map(p =>
      p.id === selectedPageId
        ? {
            ...p,
            components: [...(p.components || []), newComponent],
          }
        : p
    );
    setPages(updatedPages);
    setSelectedComponentId(newComponent.id);
    setHasUnsavedChanges(true);
  };

  const handleComponentUpdate = (componentId: string, updates: Partial<IWireframeComponent>) => {
    if (!selectedPageId) return;
    const updatedPages = pages.map(p =>
      p.id === selectedPageId
        ? {
            ...p,
            components: (p.components || []).map(c =>
              c.id === componentId ? { ...c, ...updates } : c
            ),
          }
        : p
    );
    setPages(updatedPages);
    setHasUnsavedChanges(true);
  };

  const handleComponentDelete = (componentId: string) => {
    if (!selectedPageId) return;
    const updatedPages = pages.map(p =>
      p.id === selectedPageId
        ? {
            ...p,
            components: (p.components || []).filter(c => c.id !== componentId),
          }
        : p
    );
    setPages(updatedPages);
    setHasUnsavedChanges(true);
    if (selectedComponentId === componentId) {
      setSelectedComponentId(null);
    }
  };

  const snapToGrid = (value: number): number => {
    const GRID_SIZE = 20;
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  const handleComponentSelect = (type: ComponentType) => {
    if (!selectedPageId) {
      if (pages.length === 0) {
        handlePageAdd();
      } else {
        setSelectedPageId(pages[0].id);
        setViewMode('wireframe');
      }
    }
    // Component will be added at center of canvas, snapped to grid
    const defaultComponent: Omit<IWireframeComponent, 'id'> = {
      type,
      label: type === 'user-menu' ? 'User Menu' : type.charAt(0).toUpperCase() + type.slice(1),
      x: snapToGrid(400),
      y: snapToGrid(200),
      width: snapToGrid(type === 'header' ? 1200 : type === 'footer' ? 1200 : type === 'button' ? 120 : type === 'user-menu' ? 50 : 300),
      height: snapToGrid(type === 'header' ? 80 : type === 'footer' ? 100 : type === 'button' ? 40 : type === 'user-menu' ? 50 : 100),
    };
    handleComponentAdd(defaultComponent, defaultComponent.x, defaultComponent.y);
  };

  const handleSave = async () => {
    if (isSavingRef.current) return; // Prevent duplicate saves
    
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      // Ensure all pages have their latest positions
      // Priority: pagePositions map > pages state x/y > no position
      const pagesWithPositions = pages.map(page => {
        const position = pagePositions.get(page.id);
        if (position) {
          return { ...page, x: position.x, y: position.y };
        }
        // If no position in map but page already has x/y from handlePageUpdate, use them
        if (page.x !== undefined && page.y !== undefined) {
          return page;
        }
        // Otherwise, no position to save
        return page;
      });
      
      console.log('[WireframeBuilder] Saving pages:', pagesWithPositions.map(p => ({ id: p.id, name: p.name, x: p.x, y: p.y })));
      
      // Save pages with positions and connections
      await onSave({ pages: pagesWithPositions, connections });
      
      // Update local pages state with positions so they're preserved
      setPages(pagesWithPositions);
      
      // Update refs after successful save to mark as saved
      prevPagesRef.current = JSON.stringify(pagesWithPositions);
      prevConnectionsRef.current = JSON.stringify(connections);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving site structure:', error);
      alert('Failed to save site structure. Please try again.');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-white dark:bg-gray-800" style={{ height: '100%' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('structure')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'structure'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Structure
            </button>
            <button
              onClick={() => setViewMode('wireframe')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'wireframe'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Layout
            </button>
          </div>

          {viewMode === 'wireframe' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedPageId || ''}
                onChange={(e) => {
                  setSelectedPageId(e.target.value || null);
                  setSelectedComponentId(null);
                }}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Select a page...</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name}
                  </option>
                ))}
              </select>
              {selectedPageId && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handlePageEdit(selectedPageId)}
                >
                  Edit Page Name
                </Button>
              )}
            </div>
          )}

          {viewMode === 'structure' && isEditMode && (
            <Button size="sm" onClick={handlePageAdd}>
              + Add Page
            </Button>
          )}
          {viewMode === 'wireframe' && (
            <Button size="sm" onClick={handlePageAdd}>
              + Create Page
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-sm text-gray-500 dark:text-gray-400">Saving...</span>
          )}
          {(viewMode === 'structure' || viewMode === 'wireframe') && hasUnsavedChanges && (
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              Save Changes
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Section & Component Palette (Desktop) */}
        {viewMode === 'wireframe' && !isMobile && (
          <SectionComponentPalette
            onSectionSelect={handleSectionSelect}
            onComponentSelect={handleComponentSelect}
          />
        )}

        {/* Canvas Area */}
        <div className="flex-1 flex overflow-hidden">
          {viewMode === 'structure' ? (
            <SiteStructureCanvas
              pages={pages}
              connections={connections}
              selectedPageId={selectedPageId}
              onPageSelect={(id) => {
                setSelectedPageId(id);
                // Don't automatically switch to layout view
              }}
              onPageAdd={handlePageAdd}
              onPageUpdate={handlePageUpdate}
              onPageEditLayout={(pageId) => {
                setSelectedPageId(pageId);
                setViewMode('wireframe');
              }}
              onConnectionAdd={handleConnectionAdd}
              onPageDelete={handlePageDelete}
              onConnectionDelete={handleConnectionDelete}
              isEditMode={true}
              onPositionsChange={setPagePositions}
            />
          ) : (
            <>
              {selectedPageId && currentPage ? (
                <WireframeCanvas
                  sections={currentPage.sections || []}
                  components={currentPage.components || []}
                  selectedSectionId={selectedSectionId}
                  selectedComponentId={selectedComponentId}
                  projectLogo={projectLogo}
                  onSectionSelect={(id) => {
                    console.log('[WireframeBuilder] onSectionSelect called with id:', id);
                    setSelectedSectionId(id);
                    prevSelectedSectionIdRef.current = id;
                    setSelectedComponentId(null);
                    if (id && !isMobile) {
                      setPropertiesOpen(true);
                    }
                  }}
                  onComponentSelect={(componentId) => {
                    setSelectedComponentId(componentId);
                    setSelectedSectionId(null);
                    if (componentId && !isMobile) {
                      setPropertiesOpen(true);
                    }
                  }}
                  onSectionUpdate={handleSectionUpdate}
                  onSectionDelete={handleSectionDelete}
                  onComponentUpdate={handleComponentUpdate}
                  onComponentAdd={handleComponentAdd}
                  onComponentDelete={handleComponentDelete}
                  onSectionAdd={(section, x, y) => {
                    const newSection: IWireframeSection = {
                      ...section,
                      id: `section-${Date.now()}`,
                      components: [],
                      x,
                      y,
                    };
                    const updatedPages = pages.map(p =>
                      p.id === selectedPageId
                        ? { ...p, sections: [...(p.sections || []), newSection] }
                        : p
                    );
                    setPages(updatedPages);
                    setSelectedSectionId(newSection.id);
                    setHasUnsavedChanges(true);
                  }}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  {pages.length === 0 ? (
                    <div className="text-center">
                      <p className="mb-4">No pages yet. Add a page to start building layouts.</p>
                      {isEditMode && (
                        <Button onClick={handlePageAdd}>Add First Page</Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <p>Select a page from the dropdown to view its layout.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Component Properties Panel (Desktop) */}
        {viewMode === 'wireframe' && !isMobile && propertiesOpen && (
          <ComponentProperties
            section={currentPage?.sections?.find(s => s.id === selectedSectionId) || null}
            component={currentPage?.components?.find(c => c.id === selectedComponentId) || null}
            pages={pages.map(p => ({ id: p.id, name: p.name }))}
            onSectionUpdate={(updates) => {
              if (selectedSectionId) {
                handleSectionUpdate(selectedSectionId, updates);
              }
            }}
            onComponentUpdate={(updates) => {
              if (selectedComponentId) {
                handleComponentUpdate(selectedComponentId, updates);
              }
            }}
            onSectionDelete={() => {
              if (selectedSectionId) {
                handleSectionDelete(selectedSectionId);
                setSelectedSectionId(null);
              }
            }}
            onComponentDelete={() => {
              if (selectedComponentId) {
                handleComponentDelete(selectedComponentId);
                setSelectedComponentId(null);
              }
            }}
            onClose={() => {
              setPropertiesOpen(false);
              setSelectedSectionId(null);
              setSelectedComponentId(null);
            }}
          />
        )}
      </div>

      {/* Mobile Component Properties */}
      {viewMode === 'wireframe' && isMobile && (selectedSectionId || selectedComponentId) && (
        <ComponentProperties
          section={currentPage?.sections?.find(s => s.id === selectedSectionId) || null}
          component={currentPage?.components?.find(c => c.id === selectedComponentId) || null}
          pages={pages.map(p => ({ id: p.id, name: p.name }))}
          onSectionUpdate={(updates) => {
            if (selectedSectionId) {
              handleSectionUpdate(selectedSectionId, updates);
            }
          }}
          onComponentUpdate={(updates) => {
            if (selectedComponentId) {
              handleComponentUpdate(selectedComponentId, updates);
            }
          }}
          onSectionDelete={() => {
            if (selectedSectionId) {
              handleSectionDelete(selectedSectionId);
              setSelectedSectionId(null);
            }
          }}
          onComponentDelete={() => {
            if (selectedComponentId) {
              handleComponentDelete(selectedComponentId);
              setSelectedComponentId(null);
            }
          }}
          onClose={() => {
            setSelectedSectionId(null);
            setSelectedComponentId(null);
          }}
        />
      )}

      {/* Page Edit Modal */}
      {editingPageId && (
        <Modal isOpen={true} onClose={handlePageEditCancel} title="Edit Page">
          <div className="p-6 space-y-4">
            <Input
              label="Page Name"
              value={pageEditName}
              onChange={(e) => setPageEditName(e.target.value)}
              placeholder="Home"
            />
            <Input
              label="Page Path"
              value={pageEditPath}
              onChange={(e) => setPageEditPath(e.target.value)}
              placeholder="/home"
            />
            <div className="flex gap-2">
              <Button onClick={handlePageEditSave} className="flex-1">
                Save
              </Button>
              <Button variant="secondary" onClick={handlePageEditCancel} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
