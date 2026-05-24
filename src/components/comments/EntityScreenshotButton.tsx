'use client';

import ScreenshotButton from '@/components/shared/ScreenshotButton';

interface EntityScreenshotButtonProps {
  entityType: 'project' | 'projectTask' | 'contentItem';
  entityId: string;
  taskIndex?: number;
  taskId?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  onUploaded?: () => void;
}

export default function EntityScreenshotButton(props: EntityScreenshotButtonProps) {
  return <ScreenshotButton {...props} />;
}
