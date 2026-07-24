import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { LensType, PhaseType } from '@/lib/hooks/useWorkspaceData';

export type GuideRole = 'Administrator' | 'Manager' | 'User';

type GuidePlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface WorkspaceGuideActions {
  openCreateMenu: () => void;
  closeCreateMenu: () => void;
  openProjectForm: () => void;
  closeProjectForm: () => void;
  closeProjectPicker: () => void;
  setPhase: (phase: PhaseType) => void;
  setLens: (lens: LensType) => void;
  openFirstProjectInspector: () => void;
  closeInspector: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
}

interface GuideActionContext {
  router: AppRouterInstance;
  workspaceActions: WorkspaceGuideActions | null;
}

export interface GuideStep {
  id: string;
  title: string;
  body: string;
  /** data-tour attribute value; omit for centered modal */
  target?: string | null;
  placement?: GuidePlacement;
  roles?: GuideRole[];
  /** Pathname prefix required for this step (defaults to any) */
  routePrefix?: string;
  onEnter?: (ctx: GuideActionContext) => void | Promise<void>;
  onExit?: (ctx: GuideActionContext) => void | Promise<void>;
  skipIfTargetMissing?: boolean;
  showCommunityLinks?: boolean;
}

export interface PlatformGuideUser {
  id: string;
  createdAt: string | null;
  platformGuideCompletedAt: string | null;
}
