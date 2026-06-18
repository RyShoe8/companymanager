'use client';

import { useEffect, useMemo } from 'react';
import { usePlatformGuideOptional } from '@/lib/platformGuide/PlatformGuideProvider';
import type { WorkspaceGuideActions } from '@/lib/platformGuide/types';
import type { LensType, PhaseType } from '@/lib/hooks/useWorkspaceData';
import type { IProject } from '@/lib/models/Project';

interface PlatformGuideWorkspaceBridgeProps {
  currentUserRole?: 'Administrator' | 'Manager' | 'User';
  allProjects: IProject[];
  setPhase: (phase: PhaseType) => void;
  setLens: (lens: LensType) => void;
  createMenuOpen: boolean;
  setCreateMenuOpen: (open: boolean) => void;
  showProjectForm: boolean;
  setShowProjectForm: (open: boolean) => void;
  setEditingProject: (project: IProject | undefined) => void;
  setProjectPickerMode: (mode: 'task' | 'content' | null) => void;
  inspectorFocus: string | null;
  setInspectorFocus: (focus: string | null) => void;
  setInspectorAutoAddTask: (v: boolean) => void;
  setInspectorOpenTaskIndex: (v: number | null) => void;
  setInspectorOpenContentId: (v: string | null) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  onViewProject: (project: IProject) => void;
}

export default function PlatformGuideWorkspaceBridge({
  currentUserRole,
  allProjects,
  setPhase,
  setLens,
  createMenuOpen,
  setCreateMenuOpen,
  showProjectForm,
  setShowProjectForm,
  setEditingProject,
  setProjectPickerMode,
  setInspectorFocus,
  setInspectorAutoAddTask,
  setInspectorOpenTaskIndex,
  setInspectorOpenContentId,
  setIsCommandPaletteOpen,
  onViewProject,
}: PlatformGuideWorkspaceBridgeProps) {
  const guide = usePlatformGuideOptional();

  const actions = useMemo<WorkspaceGuideActions>(
    () => ({
      openCreateMenu: () => setCreateMenuOpen(true),
      closeCreateMenu: () => setCreateMenuOpen(false),
      openProjectForm: () => {
        setEditingProject(undefined);
        setShowProjectForm(true);
      },
      closeProjectForm: () => setShowProjectForm(false),
      closeProjectPicker: () => setProjectPickerMode(null),
      setPhase,
      setLens,
      openFirstProjectInspector: () => {
        const first = allProjects[0];
        if (first) {
          onViewProject(first);
        }
      },
      closeInspector: () => {
        setInspectorFocus(null);
        setInspectorAutoAddTask(false);
        setInspectorOpenTaskIndex(null);
        setInspectorOpenContentId(null);
        setProjectPickerMode(null);
      },
      openCommandPalette: () => setIsCommandPaletteOpen(true),
      closeCommandPalette: () => setIsCommandPaletteOpen(false),
    }),
    [
      allProjects,
      onViewProject,
      setCreateMenuOpen,
      setEditingProject,
      setInspectorAutoAddTask,
      setInspectorFocus,
      setInspectorOpenContentId,
      setInspectorOpenTaskIndex,
      setIsCommandPaletteOpen,
      setLens,
      setPhase,
      setProjectPickerMode,
      setShowProjectForm,
    ]
  );

  useEffect(() => {
    if (!guide) return;
    guide.setUserRole(currentUserRole);
  }, [currentUserRole, guide]);

  useEffect(() => {
    if (!guide) return;
    guide.registerWorkspaceActions(actions);
    return () => guide.registerWorkspaceActions(null);
  }, [actions, guide]);

  return null;
}
