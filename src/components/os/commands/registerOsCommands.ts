import CommandRegistry, { type Command } from '@/lib/commands/CommandRegistry';
import ModuleRegistry from '@/lib/os/moduleRegistry';

interface OsCommandActions {
    openModule: (moduleId: string, options?: { payload?: Record<string, string> }) => string | null;
    focusNextWindow: () => void;
    closeAll: () => void;
    resetLayout: () => void;
    openPalette: () => void;
}

/**
 * Register OS-scoped commands with the shared CommandRegistry. Returns an
 * unsubscribe function that removes every command this call registered.
 */
export function registerOsCommands(actions: OsCommandActions): () => void {
    const registered: string[] = [];

    const register = (cmd: Command) => {
        CommandRegistry.register(cmd);
        registered.push(cmd.id);
    };

    ModuleRegistry.list()
        .filter((m) => !m.launcherHidden)
        .forEach((m) => {
        register({
            id: `os.openModule.${m.id}`,
            label: `Open ${m.title}`,
            category: 'open',
            keywords: ['os', 'module', m.id, m.title.toLowerCase()],
            voicePatterns: [
                `open ${m.title.toLowerCase()}`,
                `launch ${m.title.toLowerCase()}`,
                `show ${m.title.toLowerCase()}`,
            ],
            execute: () => actions.openModule(m.id),
        });
    });

    register({
        id: 'os.focusNextWindow',
        label: 'OS: Focus next window',
        category: 'navigate',
        keywords: ['os', 'cycle', 'next', 'window'],
        execute: () => actions.focusNextWindow(),
    });

    register({
        id: 'os.closeAll',
        label: 'OS: Close all windows',
        category: 'edit',
        keywords: ['os', 'close', 'all'],
        execute: () => actions.closeAll(),
    });

    register({
        id: 'os.resetLayout',
        label: 'OS: Reset layout',
        category: 'edit',
        keywords: ['os', 'reset', 'layout', 'clear'],
        execute: () => actions.resetLayout(),
    });

    register({
        id: 'os.openPalette',
        label: 'OS: Open command palette',
        category: 'open',
        keywords: ['os', 'palette', 'command', 'cmd k'],
        execute: () => actions.openPalette(),
    });

    return () => {
        registered.forEach((id) => CommandRegistry.unregister(id));
    };
}
