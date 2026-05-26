import type { BackendProjectStatus } from '@/lib/utils/statusMapping';
import { mapStatusToStage } from '@/lib/utils/statusMapping';

export function getProjectWorkspaceHref(projectId: string, status: BackendProjectStatus): string {
  const stage = mapStatusToStage(status);
  const segment = stage === 'Plan' ? 'plan' : stage === 'Build' ? 'build' : 'run';
  return `/${segment}/${projectId}`;
}
