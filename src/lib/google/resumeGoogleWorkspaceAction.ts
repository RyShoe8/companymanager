import {
  clearGoogleWorkspacePendingAction,
  readGoogleWorkspacePendingAction,
  type GoogleWorkspacePendingAction,
} from '@/lib/google/clientUtils';

export const GOOGLE_ASSET_CREATED_EVENT = 'nucleas:google-asset-created';

export type GoogleWorkspaceResumeResult =
  | { status: 'none' }
  | { status: 'needs_ui'; pending: GoogleWorkspacePendingAction }
  | { status: 'completed'; step: GoogleWorkspacePendingAction['step']; name: string };

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data?.error) return String(data.error);
  } catch {
    // ignore
  }
  return fallback;
}

export function dispatchGoogleAssetCreated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GOOGLE_ASSET_CREATED_EVENT));
}

export async function resumeGoogleWorkspaceAction(): Promise<GoogleWorkspaceResumeResult> {
  const pending = readGoogleWorkspacePendingAction();
  if (!pending) return { status: 'none' };

  const statusRes = await fetch('/api/google/workspace/status');
  if (!statusRes.ok) return { status: 'none' };
  const statusData = await statusRes.json();
  if (!statusData.connected) return { status: 'none' };

  if (pending.step === 'googleFile') {
    return { status: 'needs_ui', pending };
  }

  if (!pending.draftName) {
    return { status: 'needs_ui', pending };
  }

  const body = { name: pending.draftName, ...pending.linkContext };
  const endpoint =
    pending.step === 'googleDocument'
      ? '/api/google/workspace/docs'
      : pending.step === 'googleSpreadsheet'
        ? '/api/google/workspace/sheets'
        : null;

  if (!endpoint) {
    return { status: 'needs_ui', pending };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res, 'Failed to complete Google action'));
  }

  clearGoogleWorkspacePendingAction();
  return { status: 'completed', step: pending.step, name: pending.draftName };
}
