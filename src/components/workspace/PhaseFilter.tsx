'use client';

import { PhaseType } from '@/lib/hooks/useWorkspaceData';

interface PhaseFilterProps {
    selected: PhaseType;
    onSelect: (phase: PhaseType) => void;
}

const phases: { value: PhaseType; label: string }[] = [
    { value: 'All', label: 'All' },
    { value: 'Plan', label: 'Plan' },
    { value: 'Build', label: 'Build' },
    { value: 'Run', label: 'Run' },
    { value: 'Schedule', label: 'Schedule' },
    { value: 'Clients', label: 'Clients' },
];

export default function PhaseFilter({ selected, onSelect }: PhaseFilterProps) {
    return (
        <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border" role="tablist" aria-label="Phase filter" data-tour="phase-filter">
            {phases.map((p) => (
                <button
                    key={p.value}
                    role="tab"
                    aria-selected={selected === p.value}
                    onClick={() => onSelect(p.value)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${selected === p.value
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-text-secondary hover:text-text-primary hover:bg-background-elevated'
                        }`}
                >
                    {p.label}
                </button>
            ))}
        </div>
    );
}
