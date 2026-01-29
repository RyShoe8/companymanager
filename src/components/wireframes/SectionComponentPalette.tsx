'use client';

import { useState } from 'react';
import { SectionType, ComponentType } from '@/lib/models/Wireframe';
import useIsMobile from '@/lib/hooks/useIsMobile';

interface SectionComponentPaletteProps {
  onSectionSelect: (type: SectionType) => void;
  onComponentSelect: (type: ComponentType) => void;
}

interface SectionDefinition {
  type: SectionType;
  label: string;
  icon: string;
  description: string;
}

interface ComponentDefinition {
  type: ComponentType;
  label: string;
  icon: string;
  description: string;
}

const SECTION_TYPES: SectionDefinition[] = [
  { type: 'header', label: 'Header', icon: '📋', description: 'Page header section' },
  { type: 'footer', label: 'Footer', icon: '📄', description: 'Page footer section' },
  { type: 'nav', label: 'Navigation', icon: '🧭', description: 'Navigation menu' },
  { type: 'content', label: 'Content Area', icon: '📝', description: 'Main content section' },
];

const COMPONENT_TYPES: ComponentDefinition[] = [
  { type: 'button', label: 'Button', icon: '🔘', description: 'Clickable button' },
  { type: 'form', label: 'Form', icon: '📋', description: 'Form with inputs' },
  { type: 'image', label: 'Image', icon: '🖼️', description: 'Image placeholder' },
  { type: 'text', label: 'Text', icon: '📝', description: 'Text block' },
  { type: 'container', label: 'Container', icon: '📦', description: 'Container div' },
  { type: 'link', label: 'Link', icon: '🔗', description: 'Navigation link' },
  { type: 'logo', label: 'Logo', icon: '🎨', description: 'Logo image' },
  { type: 'user-menu', label: 'User Menu', icon: '👤', description: 'User menu dropdown' },
];

export default function SectionComponentPalette({ 
  onSectionSelect, 
  onComponentSelect,
}: SectionComponentPaletteProps) {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<'sections' | 'components'>('sections');

  const handleDragStart = (e: React.DragEvent, type: SectionType | ComponentType, isSection: boolean) => {
    e.dataTransfer.setData('itemType', isSection ? 'section' : 'component');
    e.dataTransfer.setData('itemTypeValue', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 ${isMobile ? 'fixed bottom-0 left-0 right-0 z-50 max-h-[60vh] rounded-t-lg shadow-2xl' : 'w-64 h-full flex flex-col'}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">Add Items</h3>
        </div>
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as 'sections' | 'components')}
          className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="sections">Sections</option>
          <option value="components">Components</option>
        </select>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto p-2">
        {viewMode === 'sections' ? (
          <div className="space-y-1">
            {SECTION_TYPES.map((section) => (
              <div
                key={section.type}
                draggable
                onDragStart={(e) => handleDragStart(e, section.type, true)}
                onClick={() => onSectionSelect(section.type)}
                className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-move hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{section.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-white">{section.label}</div>
                    {!isMobile && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{section.description}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {COMPONENT_TYPES.map((component) => (
              <div
                key={component.type}
                draggable
                onDragStart={(e) => handleDragStart(e, component.type, false)}
                onClick={() => onComponentSelect(component.type)}
                className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-move hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{component.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-white">{component.label}</div>
                    {!isMobile && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{component.description}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
