'use client';

import { ComponentType } from '@/lib/models/Wireframe';

interface ComponentPaletteDropdownProps {
  onComponentSelect: (type: ComponentType) => void;
  disabled?: boolean;
}

interface ComponentDefinition {
  type: ComponentType;
  label: string;
  icon: string;
  description: string;
}

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

export default function ComponentPaletteDropdown({ onComponentSelect, disabled = false }: ComponentPaletteDropdownProps) {
  return (
    <select
      onChange={(e) => {
        if (e.target.value) {
          onComponentSelect(e.target.value as ComponentType);
          e.target.value = ''; // Reset dropdown
        }
      }}
      disabled={disabled}
      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      defaultValue=""
    >
      <option value="">+ Add Component</option>
      {COMPONENT_TYPES.map((component) => (
        <option key={component.type} value={component.type}>
          {component.icon} {component.label}
        </option>
      ))}
    </select>
  );
}
