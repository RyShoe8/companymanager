'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';
import {
  type ImageCropRect,
  MIN_CROP_SIZE,
  isValidCropRect,
} from '@/lib/cropImageFile';

type DisplayRect = { left: number; top: number; width: number; height: number };

interface ScreenshotRegionSelectorProps {
  imageUrl: string;
  onConfirm: (rect: ImageCropRect) => void;
  onCancel: () => void;
}

function emptyRect(): DisplayRect {
  return { left: 0, top: 0, width: 0, height: 0 };
}

function normalizeRect(startX: number, startY: number, endX: number, endY: number): DisplayRect {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  return { left, top, width, height };
}

function getImageLayout(container: DOMRect, naturalWidth: number, naturalHeight: number) {
  const scale = Math.min(container.width / naturalWidth, container.height / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  const offsetX = (container.width - width) / 2;
  const offsetY = (container.height - height) / 2;
  return { scale, offsetX, offsetY, width, height };
}

function displayRectToSourceRect(
  rect: DisplayRect,
  layout: ReturnType<typeof getImageLayout>,
  naturalWidth: number,
  naturalHeight: number
): ImageCropRect {
  const relLeft = rect.left - layout.offsetX;
  const relTop = rect.top - layout.offsetY;

  const x = Math.max(0, Math.min(naturalWidth, relLeft / layout.scale));
  const y = Math.max(0, Math.min(naturalHeight, relTop / layout.scale));
  const width = Math.min(naturalWidth - x, rect.width / layout.scale);
  const height = Math.min(naturalHeight - y, rect.height / layout.scale);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

export default function ScreenshotRegionSelector({
  imageUrl,
  onConfirm,
  onCancel,
}: ScreenshotRegionSelectorProps) {
  const [mounted, setMounted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selection, setSelection] = useState<DisplayRect>(emptyRect());
  const [sourceRect, setSourceRect] = useState<ImageCropRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const startPointRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && sourceRect && isValidCropRect(sourceRect)) {
        onConfirm(sourceRect);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, onConfirm, sourceRect]);

  const updateSelectionFromPointer = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image || !image.naturalWidth || !image.naturalHeight) return;

    const bounds = container.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    const display = normalizeRect(startPointRef.current.x, startPointRef.current.y, x, y);
    setSelection(display);

    const layout = getImageLayout(bounds, image.naturalWidth, image.naturalHeight);
    const source = displayRectToSourceRect(display, layout, image.naturalWidth, image.naturalHeight);
    setSourceRect(source);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    startPointRef.current = {
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    };
    setDragging(true);
    setSelection(emptyRect());
    setSourceRect(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateSelectionFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    updateSelectionFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    updateSelectionFromPointer(e.clientX, e.clientY);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const canConfirm = sourceRect != null && isValidCropRect(sourceRect);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90">
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/10 bg-background-card/95">
        <div>
          <p className="text-sm font-medium text-text-primary">Select an area</p>
          <p className="text-xs text-text-muted">Drag to draw a box over the capture</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canConfirm}
            onClick={() => {
              if (sourceRect && canConfirm) onConfirm(sourceRect);
            }}
          >
            Use selection
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden cursor-crosshair touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Screenshot capture"
          className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
          draggable={false}
        />

        {selection.width > 0 && selection.height > 0 && (
          <div
            className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
            style={{
              left: selection.left,
              top: selection.top,
              width: selection.width,
              height: selection.height,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            }}
          />
        )}
      </div>

      <div className="px-4 py-2 text-xs text-text-muted text-center border-t border-white/10 bg-background-card/95">
        {canConfirm
          ? `Selection: ${sourceRect!.width}×${sourceRect!.height}px`
          : `Minimum selection: ${MIN_CROP_SIZE}×${MIN_CROP_SIZE}px`}
      </div>
    </div>,
    document.body
  );
}
