'use client';

import Input from '@/components/ui/Input';

interface AssetSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function AssetSearch({ value, onChange }: AssetSearchProps) {
  return (
    <Input
      placeholder="Search assets by name, description, or tags..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
