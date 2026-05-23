'use client';

import Button from '@/components/ui/Button';

interface EntityScreenshotButtonProps {
  entityType: 'project' | 'projectTask';
  entityId: string;
  taskIndex?: number;
  taskId?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  onUploaded?: () => void;
}

export default function EntityScreenshotButton({
  entityType,
  entityId,
  taskIndex,
  taskId,
  className = 'h-[38px] min-h-0 whitespace-nowrap flex-shrink-0',
  size = 'sm',
  onUploaded,
}: EntityScreenshotButtonProps) {
  const handleUploadScreenshots = async (files: File[]) => {
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name.replace(/\.[^/.]+$/, '') || 'Screenshot');
        formData.append('type', 'screenshot');

        if (entityType === 'project' || entityType === 'projectTask') {
          formData.append('linkedProjectId', entityId);
          if (taskId) {
            formData.append('linkedProjectTaskId', taskId);
          } else if (taskIndex !== undefined) {
            formData.append('linkedProjectTaskIndex', taskIndex.toString());
          }
        }

        const response = await fetch('/api/assets/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
        return response.json();
      });

      await Promise.all(uploadPromises);
      onUploaded?.();
    } catch {
      alert('Failed to upload screenshots');
    }
  };

  const handleAddScreenshot = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await handleUploadScreenshots(Array.from(files));
      }
    };
    input.click();
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      onClick={handleAddScreenshot}
      className={className}
    >
      Add Screenshot
    </Button>
  );
}
