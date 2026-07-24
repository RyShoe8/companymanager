/**
 * Feature flags for the Nucleas redesign rollout.
 * Reads from env vars (NEXT_PUBLIC_ prefix for client-side access).
 * Defaults to true so the new workspace UI is active by default during development.
 */

export interface FeatureFlags {
  workspaceShellEnabled: boolean;
  agendaViewEnabled: boolean;
  voiceEnabled: boolean;
}

function envBool(key: string, fallback: boolean = true): boolean {
  if (typeof window !== 'undefined') {
    // Client-side: read from NEXT_PUBLIC_ env vars baked at build time
    const val = (process.env as Record<string, string | undefined>)[key];
    if (val === undefined) return fallback;
    return val !== '0' && val !== 'false';
  }
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val !== '0' && val !== 'false';
}

function getFeatureFlags(): FeatureFlags {
  return {
    workspaceShellEnabled: envBool('NEXT_PUBLIC_FF_WORKSPACE_SHELL', true),
    agendaViewEnabled: envBool('NEXT_PUBLIC_FF_AGENDA_VIEW', true),
    voiceEnabled: envBool('NEXT_PUBLIC_FF_VOICE', true),
  };
}

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag];
}
