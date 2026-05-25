'use client';

import { LensType } from '@/lib/hooks/useWorkspaceData';
import { isFeatureEnabled } from '@/lib/utils/featureFlags';

interface LensBarProps {
    selected: LensType;
    onSelect: (lens: LensType) => void;
}

const allLenses: { value: LensType; label: string; icon: string }[] = [
    { value: 'schedule', label: 'Schedule', icon: '📅' },
    { value: 'agenda', label: 'Agenda', icon: '📋' },
    { value: 'projects', label: 'Projects', icon: '📁' },
    { value: 'capacity', label: 'Capacity', icon: '👥' },
];

export default function LensBar({ selected, onSelect }: LensBarProps) {
    const lenses = allLenses.filter(
        (l) => l.value !== 'agenda' || isFeatureEnabled('agendaViewEnabled')
    );

    return (
        <div className="flex items-center gap-1" role="tablist" aria-label="View lens">
            {lenses.map((l) => (
                <button
                    key={l.value}
                    role="tab"
                    aria-selected={selected === l.value}
                    onClick={() => onSelect(l.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${selected === l.value
                            ? 'bg-gray-700 text-white border border-gray-600'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}
                >
                    <span className="text-xs">{l.icon}</span>
                    {l.label}
                </button>
            ))}
        </div>
    );
}
