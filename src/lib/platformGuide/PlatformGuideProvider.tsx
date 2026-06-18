'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { GuideRole, PlatformGuideUser, WorkspaceGuideActions } from '@/lib/platformGuide/types';
import { filterStepsForRole, PLATFORM_GUIDE_STEPS } from '@/lib/platformGuide/steps';
import { shouldAutoStart, isRestartGuideVisible } from '@/lib/platformGuide/eligibility';
import {
  clearGuideStepIndex,
  readGuideStepIndex,
  writeGuideStepIndex,
} from '@/lib/platformGuide/sessionStorage';
import PlatformGuideOverlay from '@/lib/platformGuide/PlatformGuideOverlay';

interface PlatformGuideContextValue {
  active: boolean;
  stepIndex: number;
  totalSteps: number;
  userRole?: GuideRole;
  showRestartGuide: boolean;
  registerWorkspaceActions: (actions: WorkspaceGuideActions | null) => void;
  setUserRole: (role: GuideRole | undefined) => void;
  startGuide: (fromStep?: number) => void;
  nextStep: () => void;
  endGuide: () => void;
  restartGuide: () => void;
}

const PlatformGuideContext = createContext<PlatformGuideContextValue | null>(null);

async function markGuideComplete(): Promise<void> {
  await fetch('/api/platform-guide/complete', { method: 'POST' });
}

export function PlatformGuideProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<PlatformGuideUser | null>(null);
  const [userRole, setUserRole] = useState<GuideRole | undefined>();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const workspaceActionsRef = useRef<WorkspaceGuideActions | null>(null);
  const autoStartAttemptedRef = useRef(false);
  const userLoadedRef = useRef(false);

  const filteredSteps = useMemo(
    () => filterStepsForRole(PLATFORM_GUIDE_STEPS, userRole),
    [userRole]
  );

  const showRestartGuide = useMemo(
    () => isRestartGuideVisible(user?.createdAt),
    [user?.createdAt]
  );

  const registerWorkspaceActions = useCallback((actions: WorkspaceGuideActions | null) => {
    workspaceActionsRef.current = actions;
  }, []);

  const runStepHook = useCallback(
    async (index: number, hook: 'onEnter' | 'onExit') => {
      const step = filteredSteps[index];
      if (!step) return;
      const fn = step[hook];
      if (!fn) return;
      await fn({
        router,
        workspaceActions: workspaceActionsRef.current,
      });
    },
    [filteredSteps, router]
  );

  const endGuide = useCallback(async () => {
    await runStepHook(stepIndex, 'onExit');
    setActive(false);
    clearGuideStepIndex();
    setUser((prev) =>
      prev ? { ...prev, platformGuideCompletedAt: new Date().toISOString() } : prev
    );
    try {
      await markGuideComplete();
    } catch {
      // best-effort
    }
  }, [runStepHook, stepIndex]);

  const activateStep = useCallback(
    async (index: number) => {
      const clamped = Math.max(0, Math.min(index, filteredSteps.length - 1));
      setStepIndex(clamped);
      writeGuideStepIndex(clamped);
      await runStepHook(clamped, 'onEnter');
    },
    [filteredSteps.length, runStepHook]
  );

  const startGuide = useCallback(
    (fromStep = 0) => {
      if (filteredSteps.length === 0) return;
      setActive(true);
      void activateStep(fromStep);
    },
    [activateStep, filteredSteps.length]
  );

  const restartGuide = useCallback(() => {
    clearGuideStepIndex();
    startGuide(0);
  }, [startGuide]);

  const nextStep = useCallback(async () => {
    await runStepHook(stepIndex, 'onExit');
    const next = stepIndex + 1;
    if (next >= filteredSteps.length) {
      await endGuide();
      return;
    }
    await activateStep(next);
  }, [activateStep, endGuide, filteredSteps.length, runStepHook, stepIndex]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.id || cancelled) return;
        setUser({
          id: data.id,
          createdAt: data.createdAt ?? null,
          platformGuideCompletedAt: data.platformGuideCompletedAt ?? null,
        });
        userLoadedRef.current = true;
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userLoadedRef.current || !user) return;
    if (!shouldAutoStart(user.platformGuideCompletedAt)) return;
    if (!pathname?.startsWith('/workspace')) return;
    if (!userRole) return;
    if (autoStartAttemptedRef.current) return;
    if (active) return;

    autoStartAttemptedRef.current = true;
    const saved = readGuideStepIndex();
    startGuide(saved ?? 0);
  }, [active, pathname, startGuide, user, userRole]);

  const value = useMemo<PlatformGuideContextValue>(
    () => ({
      active,
      stepIndex,
      totalSteps: filteredSteps.length,
      userRole,
      showRestartGuide,
      registerWorkspaceActions,
      setUserRole,
      startGuide,
      nextStep,
      endGuide,
      restartGuide,
    }),
    [
      active,
      endGuide,
      filteredSteps.length,
      nextStep,
      registerWorkspaceActions,
      restartGuide,
      showRestartGuide,
      startGuide,
      stepIndex,
      userRole,
    ]
  );

  const currentStep = active ? filteredSteps[stepIndex] : null;

  return (
    <PlatformGuideContext.Provider value={value}>
      {children}
      {active && currentStep ? (
        <PlatformGuideOverlay
          step={currentStep}
          stepIndex={stepIndex}
          totalSteps={filteredSteps.length}
          onNext={() => void nextStep()}
          onEnd={() => void endGuide()}
        />
      ) : null}
    </PlatformGuideContext.Provider>
  );
}

export function usePlatformGuide(): PlatformGuideContextValue {
  const ctx = useContext(PlatformGuideContext);
  if (!ctx) {
    throw new Error('usePlatformGuide must be used within PlatformGuideProvider');
  }
  return ctx;
}

export function usePlatformGuideOptional(): PlatformGuideContextValue | null {
  return useContext(PlatformGuideContext);
}
