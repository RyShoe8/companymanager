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
];

export default function PhaseFilter({ selected, onSelect }: PhaseFilterProps) {
    return (
        <div className="flex items-center bg-gray-800/60 rounded-lg p-0.5" role="tablist" aria-label="Phase filter">
            {phases.map((p) => (
                <button
                    key={p.value}
                    role="tab"
                    aria-selected={selected === p.value}
                    onClick={() => onSelect(p.value)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${selected === p.value
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                        }`}
                >
                    {p.label}
                </button>
            ))}
        </div>
    );
}
