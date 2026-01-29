'use client';

import { IWireframeSection, IWireframeComponent } from '@/lib/models/Wireframe';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import ComponentPaletteDropdown from './ComponentPaletteDropdown';
import useIsMobile from '@/lib/hooks/useIsMobile';

const GRID_SIZE = 20;

interface ComponentPropertiesProps {
  section: IWireframeSection | null;
  component: IWireframeComponent | null;
  pages: Array<{ id: string; name: string }>;
  onSectionUpdate?: (updates: Partial<IWireframeSection>) => void;
  onComponentUpdate?: (updates: Partial<IWireframeComponent>) => void;
  onSectionDelete?: () => void;
  onComponentDelete?: () => void;
  onClose?: () => void;
}

export default function ComponentProperties({ 
  section, 
  component, 
  pages, 
  onSectionUpdate, 
  onComponentUpdate, 
  onSectionDelete, 
  onComponentDelete, 
  onClose,
}: ComponentPropertiesProps) {
  const isMobile = useIsMobile();

  const snapToGrid = (value: number): number => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  if (!section && !component) {
    return (
      <div className={`bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 ${isMobile ? 'fixed bottom-0 left-0 right-0 z-50 max-h-[50vh] rounded-t-lg shadow-2xl' : 'w-80 h-full flex flex-col'}`}>
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          Select a section or component to edit properties
        </div>
      </div>
    );
  }

  // Handle component properties
  if (component && onComponentUpdate && onComponentDelete) {
    const handleUpdate = (field: keyof IWireframeComponent, value: any) => {
      if (field === 'x' || field === 'y' || field === 'width' || field === 'height') {
        value = snapToGrid(parseInt(value) || 0);
      }
      onComponentUpdate({ [field]: value });
    };

    const content = (
      <>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Component Properties</h3>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="Close properties"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <Input
              label="Label"
              value={component.label}
              onChange={(e) => handleUpdate('label', e.target.value)}
              placeholder="Component label"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Functionality
            </label>
            <textarea
              value={component.functionality || ''}
              onChange={(e) => handleUpdate('functionality', e.target.value)}
              placeholder="Describe what this component does..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Input
                label="X Position"
                type="number"
                value={component.x}
                onChange={(e) => handleUpdate('x', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Input
                label="Y Position"
                type="number"
                value={component.y}
                onChange={(e) => handleUpdate('y', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Input
                label="Width"
                type="number"
                value={component.width}
                onChange={(e) => handleUpdate('width', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Input
                label="Height"
                type="number"
                value={component.height}
                onChange={(e) => handleUpdate('height', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          {component.type === 'link' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Link to Page
              </label>
              <select
                value={component.linkedPageId || ''}
                onChange={(e) => handleUpdate('linkedPageId', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">None</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="danger"
              size="sm"
              onClick={onComponentDelete}
              className="w-full"
            >
              Delete Component
            </Button>
          </div>
        </div>
      </>
    );

    if (isMobile) {
      return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 max-h-[50vh] rounded-t-lg shadow-2xl flex flex-col">
          {content}
        </div>
      );
    }

    return (
      <div className="w-80 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
        {content}
      </div>
    );
  }

  // Handle section properties
  if (section && onSectionUpdate && onSectionDelete) {
    const handleUpdate = (field: keyof IWireframeSection, value: any) => {
      if (field === 'x' || field === 'y' || field === 'width' || field === 'height') {
        value = snapToGrid(parseInt(value) || 0);
      }
      onSectionUpdate({ [field]: value });
    };

    const content = (
      <>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Section Properties</h3>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label="Close properties"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <Input
              label="Label"
              value={section.label}
              onChange={(e) => handleUpdate('label', e.target.value)}
              placeholder="Section label"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={section.description || ''}
              onChange={(e) => handleUpdate('description', e.target.value)}
              placeholder="Describe what this section contains..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Input
                label="X Position"
                type="number"
                value={section.x}
                onChange={(e) => handleUpdate('x', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Input
                label="Y Position"
                type="number"
                value={section.y}
                onChange={(e) => handleUpdate('y', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Input
                label="Width"
                type="number"
                value={section.width}
                onChange={(e) => handleUpdate('width', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <Input
                label="Height"
                type="number"
                value={section.height}
                onChange={(e) => handleUpdate('height', parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="danger"
              size="sm"
              onClick={onSectionDelete}
              className="w-full"
            >
              Delete Section
            </Button>
          </div>
        </div>
      </>
    );

    if (isMobile) {
      return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 max-h-[50vh] rounded-t-lg shadow-2xl flex flex-col">
          {content}
        </div>
      );
    }

    return (
      <div className="w-80 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
        {content}
      </div>
    );
  }

  return null;
}
