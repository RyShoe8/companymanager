'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMobileShell } from '@/contexts/MobileShellContext';
import {
  clearReturnToActionInbox,
  shouldReturnToActionInbox,
} from '@/lib/mobile/actionInboxReturn';

type UseMobileInspectorHistoryOptions = {
  inspectorFocus: string | null;
  onCloseInspector: () => void;
  onCloseInspectorFully: () => void;
  enabled?: boolean;
};

export function useMobileInspectorHistory({
  inspectorFocus,
  onCloseInspector,
  onCloseInspectorFully,
  enabled = true,
}: UseMobileInspectorHistoryOptions) {
  const { requestReopenActionInbox } = useMobileShell();
  const historyPushedRef = useRef(false);
  const suppressPopRef = useRef(false);

  useEffect(() => {
    if (!enabled || !inspectorFocus) {
      historyPushedRef.current = false;
      return;
    }

    if (!shouldReturnToActionInbox() || historyPushedRef.current) return;

    window.history.pushState({ nucleasOverlay: 'inspector' }, '');
    historyPushedRef.current = true;

    const onPopState = () => {
      if (suppressPopRef.current) {
        suppressPopRef.current = false;
        historyPushedRef.current = false;
        return;
      }
      if (!historyPushedRef.current) return;
      historyPushedRef.current = false;
      onCloseInspectorFully();
      clearReturnToActionInbox();
      requestReopenActionInbox();
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [
    inspectorFocus,
    enabled,
    onCloseInspectorFully,
    requestReopenActionInbox,
  ]);

  const completeInspectorClose = useCallback(() => {
    const returnToAction = shouldReturnToActionInbox();
    onCloseInspector();
    if (!returnToAction) return;

    requestReopenActionInbox();
    if (historyPushedRef.current) {
      suppressPopRef.current = true;
      historyPushedRef.current = false;
      window.history.back();
    }
  }, [onCloseInspector, requestReopenActionInbox]);

  return { completeInspectorClose };
}
