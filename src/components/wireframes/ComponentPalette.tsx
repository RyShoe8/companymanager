'use client';

import { useState } from 'react';
import { ComponentType } from '@/lib/models/Wireframe';
import useIsMobile from '@/lib/hooks/useIsMobile';

interface ComponentPaletteProps {
  onComponentSelect: (type: ComponentType) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

interface ComponentDefinition {
  type: ComponentType;
  label: string;
  icon: string;
  description: string;
}

const COMPONENT_TYPES: ComponentDefinition[] = [
  { type: 'header', label: 'Header', icon: '📋', description: 'Page header section' },
  { type: 'footer', label: 'Footer', icon: '📄', description: 'Page footer section' },
  { type: 'nav', label: 'Navigation', icon: '🧭', description: 'Navigation menu' },
  { type: 'content', label: 'Content Area', icon: '📝', description: 'Main content section' },
  { type: 'button', label: 'Button', icon: '🔘', description: 'Clickable button' },
  { type: 'form', label: 'Form', icon: '📋', description: 'Form with inputs' },
  { type: 'image', label: 'Image', icon: '🖼️', description: 'Image placeholder' },
  { type: 'text', label: 'Text', icon: '📝', description: 'Text block' },
  { type: 'container', label: 'Container', icon: '📦', description: 'Container div' },
  { type: 'link', label: 'Link', icon: '🔗', description: 'Navigation link' },
];

export default function ComponentPalette({ onComponentSelect, isOpen = true, onToggle }: ComponentPaletteProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredComponents = COMPONENT_TYPES.filter(comp =>
    comp.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comp.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDragStart = (e: React.DragEvent, type: ComponentType) => {
    e.dataTransfer.setData('componentType', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleClick = (type: ComponentType) => {
    onComponentSelect(type);
  };

  if (isMobile && !isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 z-40 bg-primary text-white rounded-full p-4 shadow-lg"
        aria-label="Open component palette"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 ${isMobile ? 'fixed bottom-0 left-0 right-0 z-50 max-h-[60vh] rounded-t-lg shadow-2xl' : 'w-64 h-full flex flex-col'}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">Components</h3>
        {isMobile && onToggle && (
          <button
            onClick={onToggle}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close palette"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search (mobile) */}
      {isMobile && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <input
            type="text"
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
      )}

      {/* Component List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 sm:grid-cols-1 gap-2">
          {filteredComponents.map((comp) => (
            <div
              key={comp.type}
              draggable
              onDragStart={(e) => handleDragStart(e, comp.type)}
              onClick={() => handleClick(comp.type)}
              className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-move hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
              role="button"
              tabIndex={0}
              aria-label={`Add ${comp.label}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{comp.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{comp.label}</div>
                  {!isMobile && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{comp.description}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
