import type { ParsedIntent } from '@/lib/voice/IntentParser';

export type VoiceLlmRawIntent = {
  action?: string;
  entity?: string | null;
  title?: string | null;
  channel?: string | null;
  date?: string | null;
  notes?: string | null;
  project_name?: string | null;
  projectId?: string | null;
  navigation_target?: string | null;
};

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return String(v);
  const t = v.trim();
  return t.length ? t : null;
}

/** Map navigation_target → ParsedIntent (aligned with WorkspaceShell handleIntent + CommandRegistry). */
export function navigationTargetToParsedIntent(targetRaw: string, rawTranscript: string): ParsedIntent | null {
  const key = targetRaw.toLowerCase().replace(/\s+/g, '_');

  const navPlaces = ['workspace', 'assets', 'employees', 'employee', 'team', 'admin'] as const;
  type NavPlace = (typeof navPlaces)[number];
  const placeMap: Record<string, NavPlace> = {
    workspace: 'workspace',
    assets: 'assets',
    employees: 'employees',
    employee: 'employees',
    team: 'employees',
    admin: 'admin',
  };
  if (placeMap[key]) {
    return { type: 'NAVIGATE', confidence: 0.95, slots: { place: placeMap[key] }, rawTranscript };
  }

  if (key === 'schedule' || key === 'calendar_view') {
    return { type: 'RUN_COMMAND', confidence: 0.95, slots: { commandId: 'nav-schedule' }, rawTranscript };
  }
  if (key === 'projects' || key === 'project_list') {
    return { type: 'RUN_COMMAND', confidence: 0.95, slots: { commandId: 'nav-projects' }, rawTranscript };
  }
  if (key === 'capacity' || key === 'team_capacity') {
    return { type: 'RUN_COMMAND', confidence: 0.95, slots: { commandId: 'nav-capacity' }, rawTranscript };
  }
  if (key === 'calendar') {
    return { type: 'RUN_COMMAND', confidence: 0.95, slots: { commandId: 'view-calendar' }, rawTranscript };
  }
  if (key === 'agenda') {
    return { type: 'RUN_COMMAND', confidence: 0.95, slots: { commandId: 'view-agenda' }, rawTranscript };
  }
  if (key === 'plan') {
    return { type: 'RUN_COMMAND', confidence: 0.95, slots: { commandId: 'nav-plan' }, rawTranscript };
  }
  if (key === 'build') {
    return { type: 'RUN_COMMAND', confidence: 0.95, slots: { commandId: 'nav-build' }, rawTranscript };
  }
  if (key === 'run') {
    return { type: 'RUN_COMMAND', confidence: 0.95, slots: { commandId: 'nav-run' }, rawTranscript };
  }

  return null;
}

export function voiceLlmIntentToParsedIntent(raw: unknown, rawTranscript: string): ParsedIntent | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as VoiceLlmRawIntent;
  const action = str(o.action)?.toLowerCase();

  if (!action || action === 'unknown') return null;

  if (action === 'create_task') {
    const taskName = str(o.title) || str(o.notes);
    if (!taskName) return null;
    const projectName = str(o.project_name) || '';
    const projectId = str(o.projectId) || '';
    return {
      type: 'ADD_TASK',
      confidence: 0.9,
      slots: { taskName, projectName, projectId },
      rawTranscript,
    };
  }

  if (action === 'create_content') {
    return {
      type: 'CREATE_CONTENT',
      confidence: 0.9,
      slots: {
        title: str(o.title) || '',
        channel: str(o.channel) || '',
        date: str(o.date) || '',
        notes: str(o.notes) || '',
        project_name: str(o.project_name) || '',
        projectId: str(o.projectId) || '',
      },
      rawTranscript,
    };
  }

  if (action === 'navigate') {
    const nav = str(o.navigation_target);
    if (!nav) return null;
    const mapped = navigationTargetToParsedIntent(nav, rawTranscript);
    return mapped;
  }

  return null;
}
