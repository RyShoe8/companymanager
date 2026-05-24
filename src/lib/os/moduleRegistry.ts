/**
 * ModuleRegistry: Singleton catalog of OS modules.
 *
 * Mirrors the CommandRegistry pattern so modules can be registered from any
 * file at import time and the OS shell can subscribe to changes.
 */

import type { ModuleDefinition } from './types';

class ModuleRegistryImpl {
    private modules: Map<string, ModuleDefinition> = new Map();
    private listeners: Set<() => void> = new Set();

    register(def: ModuleDefinition): void {
        this.modules.set(def.id, def);
        this.notify();
    }

    unregister(id: string): void {
        this.modules.delete(id);
        this.notify();
    }

    get(id: string): ModuleDefinition | undefined {
        return this.modules.get(id);
    }

    list(): ModuleDefinition[] {
        return Array.from(this.modules.values());
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify(): void {
        this.listeners.forEach((l) => l());
    }
}

const ModuleRegistry = new ModuleRegistryImpl();
export default ModuleRegistry;
