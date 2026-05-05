/**
 * Snapshot of high-value UI capabilities and voice coverage.
 * Used as an implementation audit checklist while expanding LLM mappings.
 */
export type VoiceCapabilityItem = {
  capability: string;
  intentType: string;
  supportedByRules: boolean;
  supportedByLlm: boolean;
  executorExists: boolean;
  notes?: string;
};

export const VOICE_CAPABILITY_MANIFEST: VoiceCapabilityItem[] = [
  { capability: 'Navigate sections', intentType: 'NAVIGATE', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Switch lens', intentType: 'SWITCH_LENS', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Switch calendar/agenda', intentType: 'SWITCH_VIEW', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Filter phase', intentType: 'FILTER_PHASE', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Set timeframe', intentType: 'SET_TIMEFRAME', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Toggle filters', intentType: 'TOGGLE_FILTER', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Open project/content/task', intentType: 'OPEN_ENTITY|OPEN_TASK', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Create task', intentType: 'ADD_TASK', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Assign task', intentType: 'ASSIGN_TASK', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Assign project', intentType: 'ASSIGN_PROJECT', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Rename task/project', intentType: 'RENAME_TASK|RENAME_PROJECT', supportedByRules: true, supportedByLlm: false, executorExists: true, notes: 'LLM mapping limited by schema detail; covered by rules.' },
  { capability: 'Set task/project status', intentType: 'SET_TASK_STATUS|SET_PROJECT_STATUS', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Complete task', intentType: 'COMPLETE_TASK', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Delete entity', intentType: 'DELETE_ENTITY', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Create content', intentType: 'CREATE_CONTENT', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Update project description', intentType: 'UPDATE_PROJECT_DESCRIPTION', supportedByRules: true, supportedByLlm: true, executorExists: true },
  { capability: 'Run command id', intentType: 'RUN_COMMAND', supportedByRules: true, supportedByLlm: true, executorExists: true },
];
