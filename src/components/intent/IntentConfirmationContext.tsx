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
import type { ParsedIntent } from '@/lib/voice/IntentParser';
import type { WorkspaceIntentContextPayload } from '@/lib/voice/workspaceIntentContext';

export type PendingIntentConfirmation = {
  sourceText: string;
  intent: ParsedIntent;
  parseSource: 'llm' | 'rules';
  origin: 'voice' | 'palette';
  contextSnapshot: WorkspaceIntentContextPayload | null;
};

type ExecuteResult = { success: boolean; message: string };

type IntentConfirmationContextValue = {
  pending: PendingIntentConfirmation | null;
  presentConfirmation: (p: PendingIntentConfirmation) => void;
  patchPendingSlots: (partial: Record<string, string>) => void;
  confirm: () => Promise<ExecuteResult | undefined>;
  cancel: () => void;
};

const IntentConfirmationContext = createContext<IntentConfirmationContextValue | null>(null);

export function useIntentConfirmation(): IntentConfirmationContextValue {
  const ctx = useContext(IntentConfirmationContext);
  if (!ctx) {
    throw new Error('useIntentConfirmation must be used within IntentConfirmationProvider');
  }
  return ctx;
}

export function useIntentConfirmationOptional(): IntentConfirmationContextValue | null {
  return useContext(IntentConfirmationContext);
}

interface IntentConfirmationProviderProps {
  children: ReactNode;
  executeIntent: (intent: ParsedIntent) => ExecuteResult | Promise<ExecuteResult>;
  onExecuted?: (result: ExecuteResult, meta: { origin: 'voice' | 'palette' }) => void;
}

export function IntentConfirmationProvider({
  children,
  executeIntent,
  onExecuted,
}: IntentConfirmationProviderProps) {
  const [pending, setPending] = useState<PendingIntentConfirmation | null>(null);
  const executeRef = useRef(executeIntent);
  /** Mirrors `pending` so confirm can read latest without TS assuming ref stayed null after clear. */
  const pendingMirrorRef = useRef<PendingIntentConfirmation | null>(null);
  pendingMirrorRef.current = pending;
  executeRef.current = executeIntent;

  const presentConfirmation = useCallback((p: PendingIntentConfirmation) => {
    setPending(p);
  }, []);

  const patchPendingSlots = useCallback((partial: Record<string, string>) => {
    setPending((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        intent: {
          ...prev.intent,
          slots: { ...prev.intent.slots, ...partial },
        },
      };
    });
  }, []);

  const cancel = useCallback(() => {
    setPending(null);
  }, []);

  const confirm = useCallback(async (): Promise<ExecuteResult | undefined> => {
    const snap = pendingMirrorRef.current;
    setPending(null);
    if (!snap) return undefined;
    const result = await Promise.resolve(executeRef.current(snap.intent));
    onExecuted?.(result, { origin: snap.origin });
    return result;
  }, [onExecuted]);

  const value = useMemo(
    () => ({
      pending,
      presentConfirmation,
      patchPendingSlots,
      confirm,
      cancel,
    }),
    [pending, presentConfirmation, patchPendingSlots, confirm, cancel]
  );

  return (
    <IntentConfirmationContext.Provider value={value}>{children}</IntentConfirmationContext.Provider>
  );
}
