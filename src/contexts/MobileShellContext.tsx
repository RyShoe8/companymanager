'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type MobileNavEntity = { id: string; name: string };

export type MobileInboxItem = {
  id: string;
  label: string;
  subtitle?: string;
  type: 'task' | 'content' | 'project' | 'client';
  status: 'new' | 'updated';
  onOpen: () => void;
};

export type MobileShellActions = {
  onLensSelect?: (lens: 'schedule' | 'agenda' | 'clients' | 'capacity') => void;
  onPhaseSelect?: (phase: 'All' | 'Plan' | 'Build' | 'Run' | 'Schedule') => void;
  onViewProject?: (projectId: string) => void;
  onViewClient?: (clientId: string) => void;
  onCreateProject?: () => void;
  onCreateClient?: () => void;
  onCreateTask?: () => void;
  onCreateContent?: () => void;
  onCreateMeeting?: () => void;
  onCreateScreenshot?: () => void;
  onCreateRecord?: () => void;
};

export type MobileShellZeroArgAction = Exclude<
  keyof MobileShellActions,
  'onLensSelect' | 'onPhaseSelect' | 'onViewProject' | 'onViewClient'
>;

export type MobileVoiceControl = {
  enabled: boolean;
  state: 'idle' | 'listening' | 'processing' | 'confirming';
  wakeWordEnabled: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggleWakeWord: () => void;
};

type MobileShellState = {
  actions: MobileShellActions;
  projects: MobileNavEntity[];
  clients: MobileNavEntity[];
  inboxItems: MobileInboxItem[];
  isManagerOrAdmin: boolean;
  voice: MobileVoiceControl | null;
};

const defaultState: MobileShellState = {
  actions: {},
  projects: [],
  clients: [],
  inboxItems: [],
  isManagerOrAdmin: false,
  voice: null,
};

type MobileShellContextValue = MobileShellState & {
  registerShell: (patch: Partial<MobileShellState>) => void;
  clearShell: () => void;
  runAction: (key: MobileShellZeroArgAction) => void;
};

const MobileShellContext = createContext<MobileShellContextValue | null>(null);

export function MobileShellProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MobileShellState>(defaultState);

  const registerShell = useCallback((patch: Partial<MobileShellState>) => {
    setState((prev) => ({
      actions: patch.actions ?? prev.actions,
      projects: patch.projects ?? prev.projects,
      clients: patch.clients ?? prev.clients,
      inboxItems: patch.inboxItems ?? prev.inboxItems,
      isManagerOrAdmin: patch.isManagerOrAdmin ?? prev.isManagerOrAdmin,
      voice: patch.voice !== undefined ? patch.voice : prev.voice,
    }));
  }, []);

  const clearShell = useCallback(() => {
    setState(defaultState);
  }, []);

  const runAction = useCallback(
    (key: MobileShellZeroArgAction) => {
      const fn = state.actions[key];
      if (typeof fn === 'function') fn();
    },
    [state.actions]
  );

  const value = useMemo(
    () => ({
      ...state,
      registerShell,
      clearShell,
      runAction,
    }),
    [state, registerShell, clearShell, runAction]
  );

  return <MobileShellContext.Provider value={value}>{children}</MobileShellContext.Provider>;
}

export function useMobileShell(): MobileShellContextValue {
  const ctx = useContext(MobileShellContext);
  if (!ctx) {
    return {
      ...defaultState,
      registerShell: () => {},
      clearShell: () => {},
      runAction: () => {},
    };
  }
  return ctx;
}
