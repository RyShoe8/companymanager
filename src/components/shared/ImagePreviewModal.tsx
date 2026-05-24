'use client';

import Modal from '@/components/ui/Modal';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  src: string | null;
  title?: string;
}

export default function ImagePreviewModal({ isOpen, onClose, src, title = 'Screenshot' }: ImagePreviewModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="4xl" elevated>
      {src ? (
        <div className="flex justify-center items-center p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={title}
            className="max-w-full max-h-[75vh] object-contain rounded"
          />
        </div>
      ) : null}
    </Modal>
  );
}
