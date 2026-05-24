'use client';

import { useEffect, useState } from 'react';
import ModuleRegistry from '@/lib/os/moduleRegistry';
import type { ModuleDefinition } from '@/lib/os/types';

export function useModuleRegistry(): ModuleDefinition[] {
    const [modules, setModules] = useState<ModuleDefinition[]>(() => ModuleRegistry.list());

    useEffect(() => {
        const update = () => setModules(ModuleRegistry.list());
        update();
        return ModuleRegistry.subscribe(update);
    }, []);

    return modules;
}
