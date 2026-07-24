'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type MobileNavEntity = { id: string; name: string };

export type MobileInboxItem = {
  id: string;
  label: string;
  subtitle?: string;
  type: 'task' | 'content' | 'project' | 'client';
  status: 'new' | 'updated';
  onOpen: () => void;
};

type MobileShellActions = {
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

export type PendingCreateAction = 'screenshot' | 'record';

const PENDING_CREATE_ACTION_KEY = 'nucleas-mobile-pending-create-action';

const WORKSPACE_SHELL_ROUTES = ['/workspace', '/plan', '/build', '/run', '/projects'] as const;

export function isWorkspaceShellRoute(pathname: string): boolean {
  return WORKSPACE_SHELL_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function readPendingCreateAction(): PendingCreateAction | null {
  if (typeof window === 'undefined') return null;
  const value = sessionStorage.getItem(PENDING_CREATE_ACTION_KEY);
  if (value === 'screenshot' || value === 'record') return value;
  return null;
}

type MobileVoiceControl = {
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
  queueCreateAction: (action: PendingCreateAction) => void;
  consumeCreateAction: () => PendingCreateAction | null;
  registerReopenActionInbox: (fn: (() => void) | null) => void;
  requestReopenActionInbox: () => void;
};

const MobileShellContext = createContext<MobileShellContextValue | null>(null);

export function MobileShellProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MobileShellState>(defaultState);
  const reopenActionInboxRef = useRef<(() => void) | null>(null);

  const registerReopenActionInbox = useCallback((fn: (() => void) | null) => {
    reopenActionInboxRef.current = fn;
  }, []);

  const requestReopenActionInbox = useCallback(() => {
    reopenActionInboxRef.current?.();
  }, []);

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

  const queueCreateAction = useCallback((action: PendingCreateAction) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(PENDING_CREATE_ACTION_KEY, action);
  }, []);

  const consumeCreateAction = useCallback((): PendingCreateAction | null => {
    const action = readPendingCreateAction();
    if (action && typeof window !== 'undefined') {
      sessionStorage.removeItem(PENDING_CREATE_ACTION_KEY);
    }
    return action;
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      registerShell,
      clearShell,
      runAction,
      queueCreateAction,
      consumeCreateAction,
      registerReopenActionInbox,
      requestReopenActionInbox,
    }),
    [
      state,
      registerShell,
      clearShell,
      runAction,
      queueCreateAction,
      consumeCreateAction,
      registerReopenActionInbox,
      requestReopenActionInbox,
    ]
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
      queueCreateAction: () => {},
      consumeCreateAction: () => null,
      registerReopenActionInbox: () => {},
      requestReopenActionInbox: () => {},
    };
  }
  return ctx;
}
