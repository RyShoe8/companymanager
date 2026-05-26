'use client';

import React from 'react';
import ActionMenu, { ActionMenuItem } from '@/components/ui/ActionMenu';

interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export default function Dropdown({ trigger, items, align = 'right' }: DropdownProps) {
  const menuItems: ActionMenuItem[] = items.map((item) => ({
    label: item.label,
    onClick: item.onClick,
    icon: item.icon,
  }));

  return (
    <ActionMenu
      align={align}
      width="w-48"
      items={menuItems}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="flex items-center focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
        >
          {trigger}
        </button>
      )}
    />
  );
}
