import 'server-only';
import { AiObjective, AiPlan, AiRun, AiRunEvent, AiBudget, AiBudgetReservation, AiPlanningJob, AiDispatchLock } from '@/lib/models/AiControl';

import { AiSettings, AiSettingsAudit } from '@/lib/models/AiSettings';

let readiness: Promise<void> | undefined;
/** Additive only: never drop or sync indexes. Uniqueness must exist before concurrent writes. */
export function ensureAiIndexes() {
  readiness ??= Promise.all([AiObjective, AiPlan, AiRun, AiRunEvent, AiBudget, AiBudgetReservation, AiPlanningJob, AiDispatchLock, AiSettings, AiSettingsAudit]
    .map(model => model.createIndexes())).then(() => undefined).catch(error => { readiness = undefined; throw error; });
  return readiness;
}
