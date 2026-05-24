import { createElement } from 'react';
import ModuleRegistry from '@/lib/os/moduleRegistry';
import type { ModuleDefinition } from '@/lib/os/types';
import ProjectsModule from './ProjectsModule';
import VoiceModule from './VoiceModule';
import PlaceholderModule from './PlaceholderModule';

let registered = false;

/**
 * Register all Phase 1 OS modules. Safe to call multiple times.
 *
 * Modules are registered as a centralized batch (rather than side-effect
 * imports) so the registry's bootstrap is deterministic and easy to find.
 */
export function registerOsModules(): void {
    if (registered) return;
    registered = true;

    const baseSize = { width: 520, height: 400 };
    const baseMin = { width: 320, height: 220 };

    const definitions: ModuleDefinition[] = [
        {
            id: 'projects',
            title: 'Projects',
            icon: '📁',
            defaultSize: baseSize,
            minSize: baseMin,
            canPopout: true,
            permissions: 'member',
            render: () => createElement(ProjectsModule),
        },
        {
            id: 'tasks',
            title: 'Tasks',
            icon: '✅',
            defaultSize: baseSize,
            minSize: baseMin,
            canPopout: true,
            permissions: 'member',
            render: () =>
                createElement(PlaceholderModule, {
                    title: 'Tasks',
                    description: 'Cross-project task list will live here.',
                }),
        },
        {
            id: 'content',
            title: 'Content',
            icon: '📝',
            defaultSize: baseSize,
            minSize: baseMin,
            canPopout: true,
            permissions: 'member',
            render: () =>
                createElement(PlaceholderModule, {
                    title: 'Content',
                    description: 'Content calendar and channel filters.',
                }),
        },
        {
            id: 'assets',
            title: 'Assets',
            icon: '🗂️',
            defaultSize: baseSize,
            minSize: baseMin,
            canPopout: true,
            permissions: 'member',
            render: () =>
                createElement(PlaceholderModule, {
                    title: 'Assets',
                    description: 'Screenshots, files, and links attached to work.',
                }),
        },
        {
            id: 'search',
            title: 'Search',
            icon: '🔎',
            defaultSize: { width: 480, height: 320 },
            minSize: baseMin,
            canPopout: true,
            permissions: 'member',
            render: () =>
                createElement(PlaceholderModule, {
                    title: 'Search',
                    description: 'Global search across projects, tasks, content, and assets.',
                }),
        },
        {
            id: 'voice',
            title: 'Voice',
            icon: '🎙️',
            defaultSize: { width: 420, height: 360 },
            minSize: baseMin,
            canPopout: false,
            permissions: 'member',
            render: () => createElement(VoiceModule),
        },
        {
            id: 'activity',
            title: 'Activity',
            icon: '📈',
            defaultSize: baseSize,
            minSize: baseMin,
            canPopout: true,
            permissions: 'member',
            render: () =>
                createElement(PlaceholderModule, {
                    title: 'Activity',
                    description: 'Recent actions across your workspace.',
                }),
        },
        {
            id: 'smart-buttons',
            title: 'Smart Buttons',
            icon: '⚡',
            defaultSize: baseSize,
            minSize: baseMin,
            canPopout: true,
            permissions: 'member',
            render: () =>
                createElement(PlaceholderModule, {
                    title: 'Smart Buttons',
                    description: 'Quick-action surfaces and partner shortcuts.',
                }),
        },
    ];

    definitions.forEach((d) => ModuleRegistry.register(d));
}
