'use client';

import BottomSheet from '@/components/ui/BottomSheet';
import WorkspaceViewOptions, { type WorkspaceViewOptionsProps } from '@/components/workspace/WorkspaceViewOptions';

type WorkspaceViewOptionsSheetProps = WorkspaceViewOptionsProps & {
  isOpen: boolean;
  onClose: () => void;
};

export default function WorkspaceViewOptionsSheet({
  isOpen,
  onClose,
  ...options
}: WorkspaceViewOptionsSheetProps) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="View options" maxHeight="85vh" elevated>
      <WorkspaceViewOptions {...options} emailDigestLayout="stacked" />
    </BottomSheet>
  );
}
