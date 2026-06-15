export type ImageCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const MIN_CROP_SIZE = 16;

export function clampCropRect(
  rect: ImageCropRect,
  imageWidth: number,
  imageHeight: number
): ImageCropRect {
  const x = Math.max(0, Math.min(rect.x, imageWidth - 1));
  const y = Math.max(0, Math.min(rect.y, imageHeight - 1));
  const maxWidth = imageWidth - x;
  const maxHeight = imageHeight - y;
  const width = Math.max(0, Math.min(rect.width, maxWidth));
  const height = Math.max(0, Math.min(rect.height, maxHeight));

  return { x, y, width, height };
}

export function isValidCropRect(rect: ImageCropRect, minSize = MIN_CROP_SIZE): boolean {
  return rect.width >= minSize && rect.height >= minSize;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for cropping.'));
    };
    img.src = url;
  });
}

function canvasToPngFile(canvas: HTMLCanvasElement, fileName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to convert cropped image.'));
          return;
        }
        resolve(new File([blob], fileName, { type: 'image/png' }));
      },
      'image/png'
    );
  });
}

/** Crop an image file using source-pixel coordinates. */
export async function cropImageFile(file: File, rect: ImageCropRect): Promise<File> {
  const img = await loadImageFromFile(file);
  const imageWidth = img.naturalWidth;
  const imageHeight = img.naturalHeight;

  const clamped = clampCropRect(rect, imageWidth, imageHeight);
  if (!isValidCropRect(clamped)) {
    throw new Error(`Selection must be at least ${MIN_CROP_SIZE}×${MIN_CROP_SIZE} pixels.`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(clamped.width);
  canvas.height = Math.round(clamped.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to render cropped image.');
  }

  ctx.drawImage(
    img,
    clamped.x,
    clamped.y,
    clamped.width,
    clamped.height,
    0,
    0,
    clamped.width,
    clamped.height
  );

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return canvasToPngFile(canvas, `screenshot-${timestamp}.png`);
}
