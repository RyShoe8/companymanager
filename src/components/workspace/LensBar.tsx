'use client';

import { ReactNode } from 'react';
import { LensType } from '@/lib/hooks/useWorkspaceData';
import { isFeatureEnabled } from '@/lib/utils/featureFlags';

interface LensBarProps {
    selected: LensType;
    onSelect: (lens: LensType) => void;
    trailing?: ReactNode;
}

const allLenses: { value: LensType; label: string; icon: string }[] = [
    { value: 'schedule', label: 'Projects', icon: '📁' },
    { value: 'agenda', label: 'Agenda', icon: '📋' },
    { value: 'clients', label: 'Clients', icon: '🏢' },
    { value: 'capacity', label: 'Capacity', icon: '👥' },
];

export default function LensBar({ selected, onSelect, trailing }: LensBarProps) {
    const lenses = allLenses.filter(
        (l) => l.value !== 'agenda' || isFeatureEnabled('agendaViewEnabled')
    );

    return (
        <div className="flex flex-wrap items-center gap-2 min-w-0" data-tour="lens-bar">
            <div className="flex items-center gap-1" role="tablist" aria-label="View lens">
                {lenses.map((l) => (
                    <button
                        key={l.value}
                        role="tab"
                        aria-selected={selected === l.value}
                        onClick={() => onSelect(l.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${selected === l.value
                                ? 'bg-background-elevated text-text-primary border border-border'
                                : 'text-text-secondary hover:text-text-primary hover:bg-background-elevated'
                            }`}
                    >
                        <span className="text-xs">{l.icon}</span>
                        {l.label}
                    </button>
                ))}
            </div>
            {trailing ? <div className="ml-1 flex-shrink-0">{trailing}</div> : null}
        </div>
    );
}
