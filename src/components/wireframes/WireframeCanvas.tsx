'use client';

import { useState, useRef, useEffect, Fragment } from 'react';
import { IWireframeSection, IWireframeComponent, SectionType, ComponentType } from '@/lib/models/Wireframe';
import useIsMobile from '@/lib/hooks/useIsMobile';

interface WireframeCanvasProps {
  sections: IWireframeSection[];
  components: IWireframeComponent[]; // Components at page level
  selectedSectionId: string | null;
  selectedComponentId: string | null;
  projectLogo?: string;
  onSectionSelect: (id: string | null) => void;
  onComponentSelect: (componentId: string | null) => void;
  onSectionUpdate: (id: string, updates: Partial<IWireframeSection>) => void;
  onSectionDelete: (id: string) => void;
  onComponentUpdate: (componentId: string, updates: Partial<IWireframeComponent>) => void;
  onComponentAdd: (component: Omit<IWireframeComponent, 'id'>, x: number, y: number) => void;
  onComponentDelete: (componentId: string) => void;
  onSectionAdd: (section: Omit<IWireframeSection, 'id' | 'components'>, x: number, y: number) => void;
}

const GRID_SIZE = 20;

export default function WireframeCanvas({
  sections,
  components,
  selectedSectionId,
  selectedComponentId,
  projectLogo,
  onSectionSelect,
  onComponentSelect,
  onSectionUpdate,
  onSectionDelete,
  onComponentUpdate,
  onComponentAdd,
  onComponentDelete,
  onSectionAdd,
}: WireframeCanvasProps) {
  const isMobile = useIsMobile();
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isDraggingSection, setIsDraggingSection] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 'n' | 's' | null>(null);
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  // Debug: Log when selectedSectionId prop changes
  useEffect(() => {
    console.log('[WireframeCanvas] selectedSectionId prop changed to:', selectedSectionId);
    console.log('[WireframeCanvas] Available section IDs:', sections.map(s => s.id));
  }, [selectedSectionId, sections]);

  const snapToGrid = (value: number): number => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  // Convert screen coordinates to canvas coordinates accounting for zoom and pan
  const screenToCanvas = (screenX: number, screenY: number): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    // Account for scroll position, pan, and zoom
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom,
    };
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 3)); // Max 300%
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.25)); // Min 25%
  };

  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Handle keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          handleZoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          handleZoomReset();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Only clear selection if clicking directly on canvas background
    console.log('[WireframeCanvas] Canvas clicked, target:', e.target);
    const target = e.target as HTMLElement;
    // Check if click was on canvas itself or grid background, not on any section/component
    if (target === canvasRef.current || 
        (target.classList.contains('relative') && !target.closest('[data-section]') && !target.closest('[data-component]'))) {
      console.log('[WireframeCanvas] Clearing selection - clicked on canvas background');
      onSectionSelect(null);
      onComponentSelect(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const itemType = e.dataTransfer.getData('itemType');
    const itemTypeValue = e.dataTransfer.getData('itemTypeValue');
    
    if (!itemType || !itemTypeValue || !canvasRef.current) return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    const x = snapToGrid(canvasPos.x);
    const y = snapToGrid(canvasPos.y);

    if (itemType === 'section') {
      const sectionType = itemTypeValue as SectionType;
      const defaultSizes: Record<SectionType, { width: number; height: number }> = {
        header: { width: 1200, height: 80 },
        footer: { width: 1200, height: 100 },
        nav: { width: 1200, height: 60 },
        content: { width: 1200, height: 400 },
      };
      const size = defaultSizes[sectionType] || { width: 1200, height: 200 };
      onSectionAdd({
        type: sectionType,
        label: sectionType.charAt(0).toUpperCase() + sectionType.slice(1),
        x,
        y,
        width: snapToGrid(size.width),
        height: snapToGrid(size.height),
        props: {},
      }, x, y);
    } else if (itemType === 'component') {
      const componentType = itemTypeValue as ComponentType;
      // Components can be dropped anywhere on the canvas with absolute coordinates
      const defaultSizes: Record<ComponentType, { width: number; height: number }> = {
        button: { width: 120, height: 40 },
        form: { width: 400, height: 300 },
        image: { width: 300, height: 200 },
        text: { width: 600, height: 100 },
        container: { width: 500, height: 300 },
        link: { width: 80, height: 30 },
        logo: { width: 100, height: 100 },
        'user-menu': { width: 50, height: 50 },
      };
      const size = defaultSizes[componentType] || { width: 200, height: 100 };
      const componentWidth = snapToGrid(size.width);
      const componentHeight = snapToGrid(size.height);
      
      // Use absolute canvas coordinates
      onComponentAdd({
        type: componentType,
        label: componentType === 'user-menu' ? 'User Menu' : componentType.charAt(0).toUpperCase() + componentType.slice(1),
        x: snapToGrid(x),
        y: snapToGrid(y),
        width: componentWidth,
        height: componentHeight,
      }, x, y);
    }
  };

  const handleSectionMouseDown = (e: React.MouseEvent, sectionId: string) => {
    // Don't start dragging if clicking on a resize handle
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) {
      return;
    }
    e.stopPropagation();
    
    // Always select the section first when clicking
    if (selectedSectionId !== sectionId) {
      console.log('[WireframeCanvas] handleSectionMouseDown selecting section:', sectionId);
      onSectionSelect(sectionId);
      onComponentSelect(null);
      // Store the section ID and mouse position for potential drag
      setDraggedId(sectionId);
      const section = sections.find(s => s.id === sectionId);
      if (section && canvasRef.current) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setDragOffset({
          x: canvasPos.x - section.x,
          y: canvasPos.y - section.y,
        });
        // Store initial mouse position to detect actual drag
        dragStartPos.current = { x: e.clientX, y: e.clientY };
      }
      // Don't start dragging yet - wait for mouse move
      return;
    }
    
    // Section is already selected, start dragging
    setIsDragging(true);
    setIsDraggingSection(true);
    setDraggedId(sectionId);
    const section = sections.find(s => s.id === sectionId);
    if (!section || !canvasRef.current) return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    setDragOffset({
      x: canvasPos.x - section.x,
      y: canvasPos.y - section.y,
    });
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleComponentMouseDown = (e: React.MouseEvent, componentId: string) => {
    // Don't start dragging if clicking on a resize handle
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) {
      return;
    }
    e.stopPropagation();
    setIsDragging(true);
    setIsDraggingSection(false);
    setDraggedId(componentId);
    const component = components.find(c => c.id === componentId);
    if (!component || !canvasRef.current) return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    // Component position is absolute on canvas
    setDragOffset({
      x: canvasPos.x - component.x,
      y: canvasPos.y - component.y,
    });
  };

  const handleResizeStart = (e: React.MouseEvent, sectionId: string | null, componentId: string | null, handle: 'se' | 'sw' | 'ne' | 'nw' | 'e' | 'w' | 'n' | 's') => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeHandle(handle);
    if (componentId) {
      setDraggedId(componentId);
      setIsDraggingSection(false);
      const component = components.find(c => c.id === componentId);
      if (component && canvasRef.current) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setResizeStartSize({
          width: component.width,
          height: component.height,
          x: component.x,
          y: component.y,
        });
        setDragOffset({
          x: canvasPos.x,
          y: canvasPos.y,
        });
      }
    } else if (sectionId) {
      setDraggedId(sectionId);
      setIsDraggingSection(true);
      const section = sections.find(s => s.id === sectionId);
      if (section && canvasRef.current) {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setResizeStartSize({
          width: section.width,
          height: section.height,
          x: section.x,
          y: section.y,
        });
        setDragOffset({
          x: canvasPos.x,
          y: canvasPos.y,
        });
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!canvasRef.current) return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    const mouseX = canvasPos.x;
    const mouseY = canvasPos.y;

    if (isResizing && resizeHandle && draggedId) {
      const deltaX = (mouseX - dragOffset.x);
      const deltaY = (mouseY - dragOffset.y);
      
      let newWidth = resizeStartSize.width;
      let newHeight = resizeStartSize.height;
      let newX = resizeStartSize.x;
      let newY = resizeStartSize.y;

      // Handle different resize handles
      if (resizeHandle.includes('e')) {
        newWidth = Math.max(GRID_SIZE, snapToGrid(resizeStartSize.width + deltaX));
      }
      if (resizeHandle.includes('w')) {
        const widthChange = snapToGrid(deltaX);
        newWidth = Math.max(GRID_SIZE, resizeStartSize.width - widthChange);
        newX = snapToGrid(resizeStartSize.x + widthChange);
      }
      if (resizeHandle.includes('s')) {
        newHeight = Math.max(GRID_SIZE, snapToGrid(resizeStartSize.height + deltaY));
      }
      if (resizeHandle.includes('n')) {
        const heightChange = snapToGrid(deltaY);
        newHeight = Math.max(GRID_SIZE, resizeStartSize.height - heightChange);
        newY = snapToGrid(resizeStartSize.y + heightChange);
      }

      if (isDraggingSection) {
        onSectionUpdate(draggedId, { width: newWidth, height: newHeight, x: newX, y: newY });
      } else {
        // Component position is absolute on canvas
        const componentId = draggedId;
        onComponentUpdate(componentId, { 
          width: newWidth, 
          height: newHeight, 
          x: snapToGrid(newX), 
          y: snapToGrid(newY) 
        });
      }
    } else if (isDragging && draggedId) {
      const x = snapToGrid(mouseX - dragOffset.x);
      const y = snapToGrid(mouseY - dragOffset.y);

      if (isDraggingSection) {
        onSectionUpdate(draggedId, { x, y });
      } else {
        // Component position is absolute on canvas
        const componentId = draggedId;
        onComponentUpdate(componentId, { x, y });
      }
    }
  };

  const handleMouseUp = () => {
    // Only clear draggedId if we were actually dragging/resizing
    if (isDragging || isResizing) {
      setIsDragging(false);
      setIsResizing(false);
      setIsDraggingSection(false);
      setResizeHandle(null);
      // Don't clear draggedId immediately - let it persist for potential future drags
      // Only clear if mouse didn't move (was a click, not a drag)
      if (dragStartPos.current) {
        const moved = Math.abs((window.event as MouseEvent)?.clientX - dragStartPos.current.x) > 5 ||
                      Math.abs((window.event as MouseEvent)?.clientY - dragStartPos.current.y) > 5;
        if (!moved) {
          setDraggedId(null);
        }
      }
      dragStartPos.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent, sectionId?: string, componentId?: string) => {
    if (!canvasRef.current) return;
    const touch = e.touches[0];
    if (componentId) {
      setIsDragging(true);
      setIsDraggingSection(false);
      setDraggedId(componentId);
      const component = components.find(c => c.id === componentId);
      if (!component) return;

      const canvasPos = screenToCanvas(touch.clientX, touch.clientY);
      setDragOffset({
        x: canvasPos.x - component.x,
        y: canvasPos.y - component.y,
      });
    } else if (sectionId) {
      setIsDragging(true);
      setIsDraggingSection(true);
      setDraggedId(sectionId);
      const section = sections.find(s => s.id === sectionId);
      if (!section) return;

      const canvasPos = screenToCanvas(touch.clientX, touch.clientY);
      setDragOffset({
        x: canvasPos.x - section.x,
        y: canvasPos.y - section.y,
      });
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || !draggedId || !canvasRef.current) return;
    e.preventDefault();

    const touch = e.touches[0];
    const canvasPos = screenToCanvas(touch.clientX, touch.clientY);
    const x = snapToGrid(canvasPos.x - dragOffset.x);
    const y = snapToGrid(canvasPos.y - dragOffset.y);

    if (isDraggingSection) {
      onSectionUpdate(draggedId, { x, y });
    } else {
      // Component position is absolute on canvas
      const componentId = draggedId;
      onComponentUpdate(componentId, { x, y });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsResizing(false);
    setDraggedId(null);
    setIsDraggingSection(false);
    setResizeHandle(null);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, isResizing, draggedId, dragOffset, isDraggingSection, resizeHandle, resizeStartSize]);

  const getSectionIcon = (type: SectionType): string => {
    const icons: Record<SectionType, string> = {
      header: '📋',
      footer: '📄',
      nav: '🧭',
      content: '📝',
    };
    return icons[type] || '📦';
  };

  const getSectionColor = (type: SectionType): string => {
    const colors: Record<SectionType, string> = {
      header: 'bg-blue-100 border-blue-300',
      footer: 'bg-gray-100 border-gray-300',
      nav: 'bg-purple-100 border-purple-300',
      content: 'bg-green-100 border-green-300',
    };
    return colors[type] || 'bg-gray-100 border-gray-300';
  };

  const getComponentIcon = (type: ComponentType): string => {
    const icons: Record<ComponentType, string> = {
      button: '🔘',
      form: '📋',
      image: '🖼️',
      text: '📝',
      container: '📦',
      link: '🔗',
      logo: '🎨',
      'user-menu': '👤',
    };
    return icons[type] || '📦';
  };

  const getComponentColor = (type: ComponentType): string => {
    const colors: Record<ComponentType, string> = {
      button: 'bg-yellow-100 border-yellow-300',
      form: 'bg-pink-100 border-pink-300',
      image: 'bg-indigo-100 border-indigo-300',
      text: 'bg-white border-gray-300',
      container: 'bg-orange-100 border-orange-300',
      link: 'bg-cyan-100 border-cyan-300',
      logo: 'bg-rose-100 border-rose-300',
      'user-menu': 'bg-purple-100 border-purple-300',
    };
    return colors[type] || 'bg-gray-100 border-gray-300';
  };

  return (
    <div className="flex-1 relative bg-gray-50 dark:bg-gray-900 overflow-auto">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-1">
        <button
          onClick={handleZoomIn}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Zoom In (Ctrl/Cmd +)"
        >
          +
        </button>
        <div className="px-3 py-1 text-xs text-center text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={handleZoomOut}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          title="Zoom Out (Ctrl/Cmd -)"
        >
          −
        </button>
        <button
          onClick={handleZoomReset}
          className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors border-t border-gray-200 dark:border-gray-700"
          title="Reset Zoom (Ctrl/Cmd 0)"
        >
          Reset
        </button>
      </div>

      <div
        ref={canvasRef}
        className="w-full h-full relative"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={(e) => {
          // Only handle canvas click if clicking directly on the canvas div itself
          if (e.target === canvasRef.current) {
            handleCanvasClick(e);
          }
        }}
      >
        <div
          ref={contentRef}
          className="absolute origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              width: '10000px',
              height: '10000px',
              backgroundImage: `linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                                linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)`,
              backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            }}
          />
          <div className="relative" style={{ width: '10000px', height: '10000px' }}>
          {/* Sections */}
          {(sections || []).map((section) => {
        const isSectionSelected = section.id === selectedSectionId;
        if (isSectionSelected) {
          console.log('[WireframeCanvas] Rendering section as selected:', section.id, 'selectedSectionId prop:', selectedSectionId);
        }
        return (
          <Fragment key={section.id}>
            {/* Section Label - positioned outside to the right */}
            <div 
              className="absolute flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded z-50 pointer-events-auto"
              style={{
                left: `${section.x + section.width + 8}px`,
                top: `${section.y}px`,
              }}
            >
              <span className="text-sm">{getSectionIcon(section.type)}</span>
              <span className="font-medium text-xs text-gray-900 dark:text-white">{section.label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSectionDelete(section.id);
                }}
                className="text-red-500 hover:text-red-700 text-xs px-1 ml-1"
                title="Delete section"
              >
                ×
              </button>
            </div>
            
            {/* Section Box */}
            <div
              key={section.id}
              data-section={section.id}
              className={`absolute border-2 cursor-move touch-manipulation pointer-events-auto ${
                isSectionSelected
                  ? 'border-blue-500 shadow-lg z-30'
                  : `${getSectionColor(section.type)} dark:bg-gray-700 dark:border-gray-600 z-20`
              }`}
              style={{
                left: `${section.x}px`,
                top: `${section.y}px`,
                width: `${section.width}px`,
                height: `${section.height}px`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Don't select if clicking on a resize handle
                if ((e.target as HTMLElement).closest('[data-resize-handle]')) {
                  return;
                }
                console.log('[WireframeCanvas] Section clicked:', section.id);
                onSectionSelect(section.id);
                onComponentSelect(null);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleSectionMouseDown(e, section.id);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleTouchStart(e, section.id);
              }}
            >

            {/* Resize handles for sections */}
            {isSectionSelected && (
              <>
                {/* Corner handles */}
                <div
                  data-resize-handle
                  className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-nwse-resize -top-2 -left-2 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, section.id, null, 'nw');
                  }}
                />
                <div
                  data-resize-handle
                  className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-nesw-resize -top-2 -right-2 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, section.id, null, 'ne');
                  }}
                />
                <div
                  data-resize-handle
                  className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-nwse-resize -bottom-2 -right-2 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, section.id, null, 'se');
                  }}
                />
                <div
                  data-resize-handle
                  className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-nesw-resize -bottom-2 -left-2 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, section.id, null, 'sw');
                  }}
                />
                {/* Edge handles */}
                <div
                  data-resize-handle
                  className="absolute w-2 h-full bg-blue-500 cursor-ew-resize top-0 -left-1 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, section.id, null, 'w');
                  }}
                />
                <div
                  data-resize-handle
                  className="absolute w-2 h-full bg-blue-500 cursor-ew-resize top-0 -right-1 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, section.id, null, 'e');
                  }}
                />
                <div
                  data-resize-handle
                  className="absolute h-2 w-full bg-blue-500 cursor-ns-resize -top-1 left-0 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, section.id, null, 'n');
                  }}
                />
                <div
                  data-resize-handle
                  className="absolute h-2 w-full bg-blue-500 cursor-ns-resize -bottom-1 left-0 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, section.id, null, 's');
                  }}
                />
              </>
            )}
            </div>
          </Fragment>
        );
      })}
      
      {/* Components rendered independently at page level */}
      {(components || []).map((component) => {
        const isComponentSelected = component.id === selectedComponentId;
        return (
          <div
            key={component.id}
            data-component={component.id}
            className={`absolute border-2 cursor-move touch-manipulation ${
              isComponentSelected
                ? 'border-blue-500 shadow-lg z-40'
                : `${getComponentColor(component.type)} dark:bg-gray-600 dark:border-gray-500 z-30`
            }`}
            style={{
              left: `${component.x}px`,
              top: `${component.y}px`,
              width: `${component.width}px`,
              height: `${component.height}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              // Don't select if clicking on a resize handle
              if ((e.target as HTMLElement).closest('[data-resize-handle]')) {
                return;
              }
              onComponentSelect(component.id);
            }}
            onMouseDown={(e) => handleComponentMouseDown(e, component.id)}
            onTouchStart={(e) => handleTouchStart(e, undefined, component.id)}
          >
            <div className="p-1 h-full flex flex-col items-center justify-center text-xs text-gray-600 dark:text-gray-300 pointer-events-none">
              {component.type === 'logo' && projectLogo ? (
                <img 
                  src={projectLogo} 
                  alt="Project logo" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <>
                  <span className="text-sm">{getComponentIcon(component.type)}</span>
                  <span className="font-medium truncate w-full text-center text-[10px]">{component.label}</span>
                </>
              )}
            </div>
            {/* Resize handles for components */}
            {isComponentSelected && (
              <>
                {/* Corner handles */}
                <div
                  data-resize-handle
                  className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-nwse-resize -top-1 -left-1 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, null, component.id, 'nw');
                  }}
                />
                <div
                  data-resize-handle
                  className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-nesw-resize -top-1 -right-1 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, null, component.id, 'ne');
                  }}
                />
                <div
                  data-resize-handle
                  className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-nwse-resize -bottom-1 -right-1 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, null, component.id, 'se');
                  }}
                />
                <div
                  data-resize-handle
                  className="absolute w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-nesw-resize -bottom-1 -left-1 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, null, component.id, 'sw');
                  }}
                />
                {/* Edge handles */}
                <div
                  data-resize-handle
                  className="absolute w-1 h-full bg-blue-500 cursor-ew-resize top-0 -left-1 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, null, component.id, 'w');
                  }}
                />
                <div
                  data-resize-handle
                  className="absolute w-1 h-full bg-blue-500 cursor-ew-resize top-0 -right-1 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, null, component.id, 'e');
                  }}
                />
                <div
                  data-resize-handle
                  className="absolute h-1 w-full bg-blue-500 cursor-ns-resize -top-1 left-0 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, null, component.id, 'n');
                  }}
                />
                <div
                  data-resize-handle
                  className="absolute h-1 w-full bg-blue-500 cursor-ns-resize -bottom-1 left-0 z-50 pointer-events-auto"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, null, component.id, 's');
                  }}
                />
              </>
            )}
          </div>
        );
      })}
          </div>
        </div>
      </div>
    </div>
  );
}
