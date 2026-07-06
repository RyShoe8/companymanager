'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomSheet from '@/components/ui/BottomSheet';
import { useMobileShell, isWorkspaceShellRoute } from '@/contexts/MobileShellContext';
import {
  MOBILE_NAV_ROOT,
  resolveNavNodes,
  type MobileNavNode,
} from '@/lib/navigation/mobileNavTree';

type MobileNavSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  isPlatformAdmin: boolean;
};

function parseAction(action: string): { key: string; arg?: string } {
  const [key, arg] = action.split(':');
  return { key, arg };
}

export default function MobileNavSheet({ isOpen, onClose, isPlatformAdmin }: MobileNavSheetProps) {
  const router = useRouter();
  const shell = useMobileShell();
  const [stack, setStack] = useState<MobileNavNode[]>([]);

  const currentNodes = useMemo(() => {
    if (stack.length === 0) {
      return resolveNavNodes(MOBILE_NAV_ROOT, {
        isManagerOrAdmin: shell.isManagerOrAdmin,
        isPlatformAdmin,
      });
    }
    const parent = stack[stack.length - 1];
    if (parent.dynamic === 'projects') {
      return shell.projects.slice(0, 12).map((p) => ({
        id: `project-${p.id}`,
        label: p.name,
        action: `onViewProject:${p.id}`,
      }));
    }
    if (parent.dynamic === 'clients') {
      return shell.clients.slice(0, 12).map((c) => ({
        id: `client-${c.id}`,
        label: c.name,
        action: `onViewClient:${c.id}`,
      }));
    }
    return resolveNavNodes(parent.children ?? [], {
      isManagerOrAdmin: shell.isManagerOrAdmin,
      isPlatformAdmin,
    });
  }, [stack, shell.isManagerOrAdmin, shell.projects, shell.clients, isPlatformAdmin]);

  const breadcrumb = useMemo(() => {
    const labels = stack.map((n) => n.label);
    return ['Menu', ...labels];
  }, [stack]);

  const handleClose = useCallback(() => {
    setStack([]);
    onClose();
  }, [onClose]);

  const runShellAction = useCallback(
    (action: string) => {
      const { key, arg } = parseAction(action);
      if (key === 'onLensSelect' && arg) {
        shell.actions.onLensSelect?.(arg as 'schedule' | 'agenda' | 'clients' | 'capacity');
        handleClose();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/workspace')) {
          router.push('/workspace');
        }
        return;
      }
      if (key === 'onPhaseSelect' && arg) {
        shell.actions.onPhaseSelect?.(arg as 'All' | 'Plan' | 'Build' | 'Run' | 'Schedule');
        handleClose();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/workspace')) {
          router.push('/workspace');
        }
        return;
      }
      if (key === 'onViewProject' && arg) {
        shell.actions.onViewProject?.(arg);
        handleClose();
        router.push('/workspace');
        return;
      }
      if (key === 'onViewClient' && arg) {
        shell.actions.onViewClient?.(arg);
        handleClose();
        router.push('/workspace');
        return;
      }
      const zeroArgActions = [
        'onCreateProject',
        'onCreateClient',
        'onCreateTask',
        'onCreateContent',
        'onCreateMeeting',
        'onCreateScreenshot',
        'onCreateRecord',
      ] as const;
      if (zeroArgActions.includes(key as (typeof zeroArgActions)[number])) {
        if (key === 'onCreateScreenshot') {
          shell.queueCreateAction('screenshot');
        } else if (key === 'onCreateRecord') {
          shell.queueCreateAction('record');
        }
        shell.runAction(key as (typeof zeroArgActions)[number]);
        handleClose();
        if (
          key.startsWith('onCreate') &&
          typeof window !== 'undefined' &&
          !isWorkspaceShellRoute(window.location.pathname)
        ) {
          router.push('/workspace');
        }
      }
    },
    [shell.actions, shell.runAction, shell.queueCreateAction, handleClose, router]
  );

  const handleNodeClick = (node: MobileNavNode) => {
    if (node.href) {
      handleClose();
      router.push(node.href);
      return;
    }
    if (node.action) {
      runShellAction(node.action);
      return;
    }
    if (node.children?.length || node.dynamic) {
      setStack((prev) => [...prev, node]);
    }
  };

  const handleBack = () => {
    setStack((prev) => prev.slice(0, -1));
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      title={breadcrumb[breadcrumb.length - 1]}
      maxHeight="85vh"
      elevated
    >
      <div className="space-y-1">
        {stack.length > 0 && (
          <button
            type="button"
            onClick={handleBack}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-primary hover:bg-background-elevated"
          >
            ← Back
          </button>
        )}
        {currentNodes.length === 0 ? (
          <p className="text-sm text-text-muted px-3 py-4">Nothing here yet.</p>
        ) : (
          currentNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => handleNodeClick(node)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left hover:bg-background-elevated transition-colors"
            >
              {'icon' in node && node.icon ? (
                <span className="text-lg shrink-0">{node.icon}</span>
              ) : null}
              <span className="text-sm font-medium text-text-primary flex-1">{node.label}</span>
              {('children' in node && node.children?.length) ||
              ('dynamic' in node && node.dynamic) ||
              ('href' in node && node.href) ||
              node.action?.includes(':') ? (
                !node.action?.startsWith('onView') &&
                !node.action?.startsWith('onLens') &&
                !node.action?.startsWith('onPhase') &&
                !node.action?.startsWith('onCreate') ? (
                  <span className="text-text-muted text-xs">›</span>
                ) : null
              ) : null}
            </button>
          ))
        )}
      </div>
    </BottomSheet>
  );
}
