/**
 * CommandRegistry: Central action registry shared by Command Palette, Voice, and keyboard shortcuts.
 */

export interface Command {
    id: string;
    label: string;
    category: 'navigate' | 'create' | 'filter' | 'open' | 'view' | 'edit';
    keywords: string[];
    /** Return false to hide this command from palette / voice */
    canExecute?: () => boolean;
    execute: (...args: unknown[]) => void;
    /** For voice: natural language patterns that match this command */
    voicePatterns?: string[];
}

class CommandRegistryImpl {
    private commands: Map<string, Command> = new Map();
    private listeners: Set<() => void> = new Set();

    register(command: Command): void {
        this.commands.set(command.id, command);
        this.notifyListeners();
    }

    unregister(id: string): void {
        this.commands.delete(id);
        this.notifyListeners();
    }

    getAll(): Command[] {
        return Array.from(this.commands.values());
    }

    getExecutable(): Command[] {
        return this.getAll().filter((c) => !c.canExecute || c.canExecute());
    }

    getByCategory(category: Command['category']): Command[] {
        return this.getExecutable().filter((c) => c.category === category);
    }

    getById(id: string): Command | undefined {
        return this.commands.get(id);
    }

    search(query: string): Command[] {
        const q = query.toLowerCase().trim();
        if (!q) return this.getExecutable();
        return this.getExecutable().filter(
            (c) =>
                c.label.toLowerCase().includes(q) ||
                c.keywords.some((k) => k.toLowerCase().includes(q)) ||
                c.category.includes(q)
        );
    }

    execute(id: string, ...args: unknown[]): boolean {
        const cmd = this.commands.get(id);
        if (!cmd) return false;
        if (cmd.canExecute && !cmd.canExecute()) return false;
        cmd.execute(...args);
        return true;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners(): void {
        this.listeners.forEach((l) => l());
    }
}

// Singleton
const CommandRegistry = new CommandRegistryImpl();
export default CommandRegistry;
