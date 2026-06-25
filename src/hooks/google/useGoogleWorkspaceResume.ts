'use client';

import { useEffect, useRef } from 'react';
import {
  dispatchGoogleAssetCreated,
  GOOGLE_ASSET_CREATED_EVENT,
  resumeGoogleWorkspaceAction,
} from '@/lib/google/resumeGoogleWorkspaceAction';

function stepLabel(step: 'googleDocument' | 'googleSpreadsheet'): string {
  return step === 'googleDocument' ? 'Google Doc' : 'Google Sheet';
}

export function useGoogleWorkspaceResume(onSuccess?: (message: string) => void): void {
  const ranRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || ranRef.current) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('google_drive_connected') !== '1') return;

    ranRef.current = true;

    void (async () => {
      try {
        const result = await resumeGoogleWorkspaceAction();
        if (result.status === 'completed') {
          dispatchGoogleAssetCreated();
          const label = stepLabel(result.step as 'googleDocument' | 'googleSpreadsheet');
          onSuccess?.(`Created ${label} "${result.name}"`);
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to complete Google action');
      }
    })();
  }, [onSuccess]);
}

export function useOnGoogleAssetCreated(onCreated: () => void): void {
  useEffect(() => {
    const handler = () => onCreated();
    window.addEventListener(GOOGLE_ASSET_CREATED_EVENT, handler);
    return () => window.removeEventListener(GOOGLE_ASSET_CREATED_EVENT, handler);
  }, [onCreated]);
}
