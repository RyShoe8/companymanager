'use client';

import { useEffect, useMemo } from 'react';
import type { IClient } from '@/lib/models/Client';
import type { IContentItem } from '@/lib/models/ContentItem';
import type { IProject } from '@/lib/models/Project';
import type { PhaseType, LensType } from '@/lib/hooks/useWorkspaceData';
import { useMobileShell } from '@/contexts/MobileShellContext';
import { useVoice } from '@/components/voice/VoiceProvider';
import { buildMobileActionInbox } from '@/hooks/useMobileActionInbox';

type MobileShellBridgeProps = {
  isManagerOrAdmin: boolean;
  currentUserId: string | null | undefined;
  currentUserEmployeeId: string | null | undefined;
  projects: IProject[];
  contentItems: IContentItem[];
  clients: IClient[];
  inspectorProjectId: string | null;
  itemSeenRefreshTrigger: number;
  onLensSelect: (lens: LensType) => void;
  onPhaseSelect: (phase: PhaseType) => void;
  onViewProject: (projectId: string) => void;
  onViewClient: (clientId: string) => void;
  onCreateProject: () => void;
  onCreateClient: () => void;
  onCreateTask: () => void;
  onCreateContent: () => void;
  onCreateMeeting: () => void;
  onCreateScreenshot: () => void;
  onCreateRecord: () => void;
  onOpenTask: (projectId: string, taskId: string) => void;
  onOpenContent: (projectId: string, contentId: string) => void;
};

export default function MobileShellBridge({
  isManagerOrAdmin,
  currentUserId,
  currentUserEmployeeId,
  projects,
  contentItems,
  clients,
  inspectorProjectId,
  itemSeenRefreshTrigger,
  onLensSelect,
  onPhaseSelect,
  onViewProject,
  onViewClient,
  onCreateProject,
  onCreateClient,
  onCreateTask,
  onCreateContent,
  onCreateMeeting,
  onCreateScreenshot,
  onCreateRecord,
  onOpenTask,
  onOpenContent,
}: MobileShellBridgeProps) {
  const { registerShell, clearShell } = useMobileShell();
  const voice = useVoice();

  const navProjects = useMemo(
    () =>
      projects.slice(0, 8).map((p) => ({
        id: p._id.toString(),
        name: p.name,
      })),
    [projects]
  );

  const navClients = useMemo(
    () =>
      clients.slice(0, 8).map((c) => ({
        id: c._id.toString(),
        name: c.name,
      })),
    [clients]
  );

  const inboxItems = useMemo(
    () =>
      buildMobileActionInbox({
        userId: currentUserId,
        employeeId: currentUserEmployeeId,
        projects,
        contentItems,
        clients,
        openProjectId: inspectorProjectId,
        onOpenTask,
        onOpenContent,
        onOpenProject: onViewProject,
        onOpenClient: onViewClient,
      }),
    [
      currentUserId,
      currentUserEmployeeId,
      projects,
      contentItems,
      clients,
      inspectorProjectId,
      itemSeenRefreshTrigger,
      onOpenTask,
      onOpenContent,
      onViewProject,
      onViewClient,
    ]
  );

  const voiceControl = useMemo(
    () =>
      voice.enabled
        ? {
            enabled: voice.enabled,
            state: voice.state,
            wakeWordEnabled: voice.wakeWordEnabled,
            startListening: voice.startListening,
            stopListening: voice.stopListening,
            toggleWakeWord: voice.toggleWakeWord,
          }
        : null,
    [
      voice.enabled,
      voice.state,
      voice.wakeWordEnabled,
      voice.startListening,
      voice.stopListening,
      voice.toggleWakeWord,
    ]
  );

  useEffect(() => {
    registerShell({
      isManagerOrAdmin,
      projects: navProjects,
      clients: navClients,
      inboxItems,
      voice: voiceControl,
      actions: {
        onLensSelect: (lens) => onLensSelect(lens),
        onPhaseSelect: (phase) => onPhaseSelect(phase),
        onViewProject,
        onViewClient,
        onCreateProject,
        onCreateClient,
        onCreateTask,
        onCreateContent,
        onCreateMeeting,
        onCreateScreenshot,
        onCreateRecord,
      },
    });

    return () => clearShell();
  }, [
    registerShell,
    clearShell,
    isManagerOrAdmin,
    navProjects,
    navClients,
    inboxItems,
    voiceControl,
    onLensSelect,
    onPhaseSelect,
    onViewProject,
    onViewClient,
    onCreateProject,
    onCreateClient,
    onCreateTask,
    onCreateContent,
    onCreateMeeting,
    onCreateScreenshot,
    onCreateRecord,
  ]);

  return null;
}
