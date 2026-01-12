'use client';

import { AssetType } from '@/lib/models/Asset';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

interface AssetFiltersProps {
  type: string;
  category: string;
  onTypeChange: (type: string) => void;
  onCategoryChange: (category: string) => void;
  onClear: () => void;
  categories: string[];
}

export default function AssetFilters({
  type,
  category,
  onTypeChange,
  onCategoryChange,
  onClear,
  categories,
}: AssetFiltersProps) {
  const typeOptions = [
    { value: '', label: 'All Types' },
    { value: 'spreadsheet', label: 'Spreadsheet' },
    { value: 'document', label: 'Document' },
    { value: 'tool', label: 'Tool' },
    { value: 'folder', label: 'Folder' },
    { value: 'link', label: 'Link' },
    { value: 'other', label: 'Other' },
  ];

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...categories.map((cat) => ({ value: cat, label: cat })),
  ];

  return (
    <div className="flex gap-4 mb-4">
      <div className="flex-1">
        <Select
          value={type}
          onChange={(e) => onTypeChange(e.target.value)}
          options={typeOptions}
        />
      </div>
      <div className="flex-1">
        <Select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          options={categoryOptions}
        />
      </div>
      {(type || category) && (
        <Button variant="secondary" size="sm" onClick={onClear}>
          Clear Filters
        </Button>
      )}
    </div>
  );
}
