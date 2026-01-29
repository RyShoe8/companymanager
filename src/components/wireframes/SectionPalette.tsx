'use client';

import { SectionType } from '@/lib/models/Wireframe';

interface SectionPaletteProps {
  onSectionSelect: (type: SectionType) => void;
}

interface SectionDefinition {
  type: SectionType;
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

export default function SectionPalette({ onSectionSelect }: SectionPaletteProps) {
  return (
    <select
      onChange={(e) => {
        if (e.target.value) {
          onSectionSelect(e.target.value as SectionType);
          e.target.value = ''; // Reset dropdown
        }
      }}
      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      defaultValue=""
    >
      <option value="">+ Add Section</option>
      {SECTION_TYPES.map((section) => (
        <option key={section.type} value={section.type}>
          {section.icon} {section.label}
        </option>
      ))}
    </select>
  );
}
