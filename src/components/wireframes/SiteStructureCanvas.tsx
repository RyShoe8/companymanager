'use client';

import { useState, useRef, useEffect } from 'react';
import { IWireframePage, IWireframeConnection } from '@/lib/models/Wireframe';
import useIsMobile from '@/lib/hooks/useIsMobile';

interface SiteStructureCanvasProps {
  pages: IWireframePage[];
  connections: IWireframeConnection[];
  selectedPageId: string | null;
  onPageSelect: (pageId: string | null) => void;
  onPageAdd: () => void;
  onPageUpdate?: (pageId: string, updates: Partial<IWireframePage>) => void;
  onPageEditLayout?: (pageId: string) => void;
  onConnectionAdd: (fromPageId: string, toPageId: string) => void;
  onPageDelete: (pageId: string) => void;
  onConnectionDelete: (fromPageId: string, toPageId: string) => void;
  isEditMode: boolean;
  onPositionsChange?: (positions: Map<string, { x: number; y: number }>) => void;
}

interface PageNode {
  id: string;
  name: string;
  x: number;
  y: number;
}

const NODE_WIDTH = 280;
const NODE_HEIGHT = 160;
const NODE_SPACING = 320;

export default function SiteStructureCanvas({
  pages,
  connections,
  selectedPageId,
  onPageSelect,
  onPageAdd,
  onPageUpdate,
  onPageEditLayout,
  onConnectionAdd,
  onPageDelete,
  onConnectionDelete,
  isEditMode,
  onPositionsChange,
}: SiteStructureCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [pageNodes, setPageNodes] = useState<PageNode[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const hasDraggedRef = useRef(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Calculate hierarchy levels based on connections
  const calculateHierarchyLevels = (): Map<string, number> => {
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    
    // Find root pages (pages with no incoming connections)
    const rootPages = pages.filter(page => 
      !connections.some(conn => conn.toPageId === page.id)
    );
    
    // BFS to assign levels
    const queue: Array<{ id: string; level: number }> = rootPages.map(p => ({ id: p.id, level: 0 }));
    
    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (visited.has(id)) continue;
      
      visited.add(id);
      levels.set(id, level);
      
      // Find children (pages connected from this page)
      const children = connections
        .filter(conn => conn.fromPageId === id)
        .map(conn => conn.toPageId);
      
      children.forEach(childId => {
        if (!visited.has(childId)) {
          queue.push({ id: childId, level: level + 1 });
        }
      });
    }
    
    // Assign level 0 to pages without connections
    pages.forEach(page => {
      if (!levels.has(page.id)) {
        levels.set(page.id, 0);
      }
    });
    
    return levels;
  };
  
  // Get row Y position for a hierarchy level
  const getRowY = (level: number): number => {
    return 100 + level * NODE_SPACING;
  };

  // Convert screen coordinates to canvas coordinates accounting for zoom and pan
  const screenToCanvas = (screenX: number, screenY: number): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
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
          setZoom(prev => Math.min(prev + 0.1, 3));
        } else if (e.key === '-') {
          e.preventDefault();
          setZoom(prev => Math.max(prev - 0.1, 0.25));
        } else if (e.key === '0') {
          e.preventDefault();
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Snap page to its hierarchy row
  const snapToRow = (pageId: string, currentY: number): number => {
    const hierarchyLevels = calculateHierarchyLevels();
    const level = hierarchyLevels.get(pageId) || 0;
    const targetY = getRowY(level);
    
    // Snap if within 50px of target row
    if (Math.abs(currentY - targetY) < 50) {
      return targetY;
    }
    return currentY;
  };

  // Initialize page positions based on hierarchy or saved positions
  useEffect(() => {
    const hierarchyLevels = calculateHierarchyLevels();
    const nodesByLevel = new Map<number, PageNode[]>();
    
    // Group pages by hierarchy level
    pages.forEach((page) => {
      const level = hierarchyLevels.get(page.id) || 0;
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push({ id: page.id, name: page.name, x: 0, y: 0 });
    });
    
    // Position pages in rows based on hierarchy or use saved positions
    const nodes: PageNode[] = pages.map((page) => {
      // Priority 1: If page has saved x/y positions from database, use them (with snapping to row)
      if (page.x !== undefined && page.y !== undefined && page.x !== null && page.y !== null) {
        const level = hierarchyLevels.get(page.id) || 0;
        const targetY = getRowY(level);
        // Snap to row if close enough, otherwise use saved position
        const snappedY = Math.abs(page.y - targetY) < 50 ? targetY : page.y;
        return {
          id: page.id,
          name: page.name,
          x: page.x,
          y: snappedY,
        };
      }
      
      // Priority 2: Preserve existing position if page already exists in state (during drag)
      const existingNode = pageNodes.find(n => n.id === page.id);
      if (existingNode) {
        const level = hierarchyLevels.get(page.id) || 0;
        const targetY = getRowY(level);
        // Snap to row if close enough
        const snappedY = Math.abs(existingNode.y - targetY) < 50 ? targetY : existingNode.y;
        return { ...existingNode, name: page.name, y: snappedY };
      }
      
      // Priority 3: New page - position based on hierarchy
      const level = hierarchyLevels.get(page.id) || 0;
      const levelPages = nodesByLevel.get(level) || [];
      const pageIndexInLevel = levelPages.findIndex(p => p.id === page.id);
      const col = pageIndexInLevel % 3;
      
      return {
        id: page.id,
        name: page.name,
        x: 100 + col * NODE_SPACING,
        y: getRowY(level),
      };
    });
    
    // Always update pageNodes when pages change (to pick up x/y positions from saved data)
    setPageNodes(nodes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.map(p => `${p.id}:${p.name}:${p.x ?? 'none'},${p.y ?? 'none'}`).join('|'), connections.map(c => `${c.fromPageId}-${c.toPageId}`).join(',')]);
  
  // Notify parent of position changes in a useEffect to avoid render-time state updates
  useEffect(() => {
    if (onPositionsChange && pageNodes.length > 0) {
      const positionsMap = new Map<string, { x: number; y: number }>();
      pageNodes.forEach(node => {
        positionsMap.set(node.id, { x: node.x, y: node.y });
      });
      onPositionsChange(positionsMap);
    }
  }, [pageNodes, onPositionsChange]);

  // Update node names when pages change
  useEffect(() => {
    setPageNodes(prev => prev.map(node => {
      const page = pages.find(p => p.id === node.id);
      return page ? { ...node, name: page.name } : node;
    }));
  }, [pages]);

  const handlePageClick = (pageId: string, e: React.MouseEvent) => {
    // Don't trigger click if we just finished dragging
    if (hasDragged) {
      setHasDragged(false);
      return;
    }
    
    // Only handle connection mode clicks, don't open layout view
    if (connectingFrom) {
      if (connectingFrom !== pageId) {
        onConnectionAdd(connectingFrom, pageId);
      }
      setConnectingFrom(null);
    } else {
      // Just select the page, don't open layout view
      onPageSelect(pageId);
    }
  };

  const handlePageMouseDown = (e: React.MouseEvent, pageId: string) => {
    if (!isEditMode) return;
    e.stopPropagation();
    setIsDragging(true);
    setDraggedPageId(pageId);
    setHasDragged(false);
    hasDraggedRef.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    const node = pageNodes.find(n => n.id === pageId);
    if (!node || !canvasRef.current) return;

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    setDragOffset({
      x: canvasPos.x - node.x,
      y: canvasPos.y - node.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !draggedPageId || !canvasRef.current) return;

    // Check if we've moved enough to consider it a drag (not just a click)
    if (dragStartPos.current) {
      const deltaX = Math.abs(e.clientX - dragStartPos.current.x);
      const deltaY = Math.abs(e.clientY - dragStartPos.current.y);
      if (deltaX > 5 || deltaY > 5) {
        setHasDragged(true);
        hasDraggedRef.current = true;
      }
    }

    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    let x = canvasPos.x - dragOffset.x;
    let y = canvasPos.y - dragOffset.y;
    
    // Snap to row based on hierarchy
    y = snapToRow(draggedPageId, y);

    setPageNodes(prev =>
      prev.map(node =>
        node.id === draggedPageId ? { ...node, x, y } : node
      )
    );
  };

  const handleMouseUp = () => {
    const actuallyDragged = hasDraggedRef.current || hasDragged;
    if (draggedPageId && onPageUpdate && actuallyDragged) {
      const node = pageNodes.find(n => n.id === draggedPageId);
      if (node) {
        // Update page position when drag ends (only if actually dragged)
        console.log('[SiteStructureCanvas] handleMouseUp calling onPageUpdate:', { pageId: draggedPageId, x: node.x, y: node.y });
        onPageUpdate(draggedPageId, { x: node.x, y: node.y });
      }
    }
    setIsDragging(false);
    setDraggedPageId(null);
    dragStartPos.current = null;
    hasDraggedRef.current = false;
    // Reset hasDragged after a short delay to allow click handler to check it
    setTimeout(() => setHasDragged(false), 0);
  };

  const handleTouchStart = (e: React.TouchEvent, pageId: string) => {
    if (!isEditMode) return;
    e.stopPropagation();
    setIsDragging(true);
    setDraggedPageId(pageId);
    setHasDragged(false);
    const node = pageNodes.find(n => n.id === pageId);
    if (!node || !canvasRef.current) return;

    const touch = e.touches[0];
    dragStartPos.current = { x: touch.clientX, y: touch.clientY };
    const canvasPos = screenToCanvas(touch.clientX, touch.clientY);
    setDragOffset({
      x: canvasPos.x - node.x,
      y: canvasPos.y - node.y,
    });
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || !draggedPageId || !canvasRef.current) return;
    e.preventDefault();

    // Check if we've moved enough to consider it a drag
    if (dragStartPos.current && e.touches[0]) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - dragStartPos.current.x);
      const deltaY = Math.abs(touch.clientY - dragStartPos.current.y);
      if (deltaX > 5 || deltaY > 5) {
        setHasDragged(true);
        hasDraggedRef.current = true;
      }
    }

    const touch = e.touches[0];
    const canvasPos = screenToCanvas(touch.clientX, touch.clientY);
    let x = canvasPos.x - dragOffset.x;
    let y = canvasPos.y - dragOffset.y;
    
    // Snap to row based on hierarchy
    y = snapToRow(draggedPageId, y);

    setPageNodes(prev => {
      const updatedNodes = prev.map(node =>
        node.id === draggedPageId ? { ...node, x, y } : node
      );
      
      // Immediately notify parent of position change during drag
      if (onPositionsChange) {
        const positionsMap = new Map<string, { x: number; y: number }>();
        updatedNodes.forEach(node => {
          positionsMap.set(node.id, { x: node.x, y: node.y });
        });
        onPositionsChange(positionsMap);
      }
      
      return updatedNodes;
    });
  };

  const handleTouchEnd = () => {
    const actuallyDragged = hasDraggedRef.current || hasDragged;
    if (draggedPageId && onPageUpdate && actuallyDragged) {
      const node = pageNodes.find(n => n.id === draggedPageId);
      if (node) {
        // Update page position when drag ends (only if actually dragged)
        onPageUpdate(draggedPageId, { x: node.x, y: node.y });
      }
    }
    setIsDragging(false);
    setDraggedPageId(null);
    dragStartPos.current = null;
    hasDraggedRef.current = false;
    // Reset hasDragged after a short delay to allow click handler to check it
    setTimeout(() => setHasDragged(false), 0);
  };

  useEffect(() => {
    if (isDragging) {
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
  }, [isDragging, draggedPageId, dragOffset]);

  const getConnectionPath = (from: PageNode, to: PageNode): string => {
    const fromX = from.x + NODE_WIDTH / 2;
    const fromY = from.y + NODE_HEIGHT / 2;
    const toX = to.x + NODE_WIDTH / 2;
    const toY = to.y + NODE_HEIGHT / 2;

    const dx = toX - fromX;
    const dy = toY - fromY;
    const midX = fromX + dx / 2;
    const midY = fromY + dy / 2;

    return `M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`;
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
        onClick={() => {
          onPageSelect(null);
          setConnectingFrom(null);
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
          <div className="relative" style={{ width: '10000px', height: '10000px' }}>
            {/* SVG for connections */}
            <svg className="absolute inset-0" style={{ width: '100%', height: '100%', pointerEvents: isEditMode ? 'auto' : 'none' }}>
              {connections.map((conn, index) => {
                const fromNode = pageNodes.find(n => n.id === conn.fromPageId);
                const toNode = pageNodes.find(n => n.id === conn.toPageId);
                if (!fromNode || !toNode) return null;

                const path = getConnectionPath(fromNode, toNode);
                const midX = (fromNode.x + toNode.x) / 2 + NODE_WIDTH / 2;
                const midY = (fromNode.y + toNode.y) / 2 + NODE_HEIGHT / 2;
                
                return (
                  <g key={`${conn.fromPageId}-${conn.toPageId}-${index}`} style={{ pointerEvents: 'auto' }}>
                    <path
                      d={path}
                      stroke="#3b82f6"
                      strokeWidth={isEditMode ? "4" : "2"}
                      fill="none"
                      markerEnd="url(#arrowhead)"
                      className={isEditMode ? 'cursor-pointer hover:stroke-blue-600' : ''}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isEditMode) {
                          onConnectionDelete(conn.fromPageId, conn.toPageId);
                        }
                      }}
                    />
                    {conn.label && (
                      <text
                        x={midX}
                        y={midY}
                        fill="#6b7280"
                        fontSize="12"
                        textAnchor="middle"
                        className="dark:fill-gray-400 pointer-events-none"
                      >
                        {conn.label}
                      </text>
                    )}
                  </g>
                );
              })}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
                </marker>
              </defs>
            </svg>

            {/* Page Nodes */}
            {pageNodes.map((node) => {
              const page = pages.find(p => p.id === node.id);
              if (!page) return null;

              const isSelected = node.id === selectedPageId;
              const isConnecting = connectingFrom === node.id;

              return (
                <div
                  key={node.id}
                  className={`absolute border-2 rounded-lg touch-manipulation transition-shadow ${
                    isDragging && draggedPageId === node.id
                      ? 'cursor-grabbing shadow-2xl z-50'
                      : isEditMode
                      ? 'cursor-grab'
                      : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg z-10'
                      : isConnecting
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                  }`}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${NODE_WIDTH}px`,
                    height: `${NODE_HEIGHT}px`,
                    willChange: isDragging && draggedPageId === node.id ? 'transform' : 'auto',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePageClick(node.id, e);
                  }}
                  onMouseDown={(e) => handlePageMouseDown(e, node.id)}
                  onTouchStart={(e) => handleTouchStart(e, node.id)}
                >
                  <div className="p-4 h-full flex flex-col items-center justify-center relative">
                    <div className="font-semibold text-lg text-gray-900 dark:text-white text-center truncate w-full">
                      {node.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-2 truncate w-full text-center">
                      {page.path}
                    </div>
                    {isEditMode && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        {onPageEditLayout && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPageEditLayout(node.id);
                            }}
                            className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors flex items-center gap-1"
                            aria-label="Edit layout"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Layout
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Are you sure you want to delete "${node.name}"?`)) {
                              onPageDelete(node.id);
                            }
                          }}
                          className="px-2 py-1 bg-red-500 text-white text-xs rounded-md hover:bg-red-600 transition-colors flex items-center gap-1"
                          aria-label="Delete page"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add Page Button - Only show on mobile */}
            {isEditMode && isMobile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPageAdd();
                }}
                className="absolute bottom-4 right-4 bg-primary text-white rounded-full p-4 shadow-lg hover:bg-primary-hover transition-colors z-20"
                aria-label="Add page"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            )}

            {/* Connection Mode Controls */}
            {isEditMode && (
              <div className="absolute bottom-4 left-4 z-30">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConnectingFrom(connectingFrom ? null : (selectedPageId || pages[0]?.id || null));
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    connectingFrom
                      ? 'bg-green-500 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {connectingFrom ? 'Cancel Connection' : 'Connect Pages'}
                </button>
              </div>
            )}

            {/* Connection Mode Indicator */}
            {connectingFrom && (
              <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-30">
                Click a page to connect from &quot;{pageNodes.find(n => n.id === connectingFrom)?.name}&quot;
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
