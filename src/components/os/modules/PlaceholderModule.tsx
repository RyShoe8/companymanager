'use client';

import { type ReactNode } from 'react';

interface PlaceholderModuleProps {
    title: string;
    description?: string;
    children?: ReactNode;
}

export default function PlaceholderModule({ title, description, children }: PlaceholderModuleProps) {
    return (
        <div className="p-6 text-sm text-zinc-400 space-y-2">
            <h3 className="text-base font-medium text-zinc-200">{title}</h3>
            {description && <p>{description}</p>}
            {children}
            <p className="text-xs text-zinc-600 pt-4">
                Phase 1 placeholder. Real module body lands in Phase 2.
            </p>
        </div>
    );
}
