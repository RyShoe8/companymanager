const GOOGLE_WORKSPACE_PENDING_KEY = 'googleWorkspacePendingAction';

export type GoogleWorkspacePendingAction = {
  step: 'googleDocument' | 'googleSpreadsheet' | 'googleFile';
  linkContext: Record<string, string | number | undefined>;
  draftName?: string;
};

export function saveGoogleWorkspacePendingAction(action: GoogleWorkspacePendingAction): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(GOOGLE_WORKSPACE_PENDING_KEY, JSON.stringify(action));
}

export function readGoogleWorkspacePendingAction(): GoogleWorkspacePendingAction | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(GOOGLE_WORKSPACE_PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GoogleWorkspacePendingAction;
  } catch {
    return null;
  }
}

export function clearGoogleWorkspacePendingAction(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(GOOGLE_WORKSPACE_PENDING_KEY);
}

export function buildGoogleConnectUrl(returnTo?: string): string {
  const path = '/api/google/workspace/connect';
  if (!returnTo) return path;
  return `${path}?returnTo=${encodeURIComponent(returnTo)}`;
}

function formatAssetTypeLabel(type: string): string {
  switch (type) {
    case 'text':
      return 'Note';
    case 'document':
      return 'Document';
    case 'spreadsheet':
      return 'Spreadsheet';
    case 'file':
      return 'File';
    default:
      if (!type) return 'Other';
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

function isInAppTextAsset(type: string): boolean {
  return type === 'text';
}

function isGoogleWorkspaceAsset(type: string): boolean {
  return type === 'document' || type === 'spreadsheet' || type === 'file';
}
