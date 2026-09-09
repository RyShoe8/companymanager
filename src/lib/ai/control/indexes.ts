import 'server-only';
import { AiObjective, AiPlan, AiRun, AiRunEvent, AiBudget, AiBudgetReservation, AiPlanningJob, AiDispatchLock, AiRunAcknowledgement } from '@/lib/models/AiControl';

import { AiSettings, AiSettingsAudit } from '@/lib/models/AiSettings';
import { AiDispatchUsage } from '@/lib/models/AiControl';
import WorkspaceNotificationEvent from '@/lib/models/WorkspaceNotificationEvent';
import { AiServiceIdentity, AiServiceGrant, AiServiceIdentityAudit } from '@/lib/models/AiServiceIdentity';
import { AiArtifact, AiArtifactReview, AiArtifactAcceptance } from '@/lib/models/AiArtifactReview';

let readiness: Promise<void> | undefined;
/** Additive only: never drop or sync indexes. Uniqueness must exist before concurrent writes. */
export function ensureAiIndexes() {
  readiness ??= Promise.all([AiArtifact, AiArtifactReview, AiArtifactAcceptance, AiServiceIdentity, AiServiceGrant, AiServiceIdentityAudit, AiObjective, AiPlan, AiRun, AiRunEvent, AiBudget, AiBudgetReservation, AiPlanningJob, AiDispatchLock, AiDispatchUsage, AiRunAcknowledgement, AiSettings, AiSettingsAudit, WorkspaceNotificationEvent]
    .map(model => model.createIndexes())).then(() => undefined).catch(error => { readiness = undefined; throw error; });
  return readiness;
}
