'use client';

import type { ReactNode } from 'react';

interface ModalActionProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  disabled?: boolean;
}

const variantClasses = {
  default: 'text-gray-900 hover:bg-gray-50',
  danger: 'text-red-600 hover:bg-red-50',
  success: 'text-emerald-700 hover:bg-emerald-50',
  warning: 'text-amber-700 hover:bg-amber-50',
};

export default function ModalAction({
  icon,
  label,
  onClick,
  variant = 'default',
  disabled = false,
}: ModalActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors font-medium ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
