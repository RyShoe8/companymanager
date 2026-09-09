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
import { consumePendingConfirmation } from '@/lib/voice/pendingConfirmation';

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
  /** Event-owned slot: edits, cancellation and consumption are synchronous. */
  const pendingMirrorRef = useRef<PendingIntentConfirmation | null>(null);

  const presentConfirmation = useCallback((p: PendingIntentConfirmation) => {
    pendingMirrorRef.current = p;
    setPending(p);
  }, []);

  const patchPendingSlots = useCallback((partial: Record<string, string>) => {
    const prev = pendingMirrorRef.current;
    if (!prev) return;
    const next = {
      ...prev,
      intent: { ...prev.intent, slots: { ...prev.intent.slots, ...partial } },
    };
    pendingMirrorRef.current = next;
    setPending(next);
  }, []);

  const cancel = useCallback(() => {
    pendingMirrorRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback(async (): Promise<ExecuteResult | undefined> => {
    const snap = consumePendingConfirmation(pendingMirrorRef);
    setPending(null);
    if (!snap) return undefined;
    const result = await Promise.resolve(executeIntent(snap.intent));
    onExecuted?.(result, { origin: snap.origin });
    return result;
  }, [executeIntent, onExecuted]);

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
