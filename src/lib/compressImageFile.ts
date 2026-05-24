const MAX_DIMENSION = 1920;
const WEBP_QUALITY = 0.8;
const JPEG_QUALITY = 0.85;

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
      reject(new Error('Failed to load image for compression.'));
    };
    img.src = url;
  });
}

function scaledDimensions(width: number, height: number): { width: number; height: number } {
  const maxSide = Math.max(width, height);
  if (maxSide <= MAX_DIMENSION) {
    return { width, height };
  }
  const scale = MAX_DIMENSION / maxSide;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`Failed to compress image as ${type}.`));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

function replaceExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^/.]+$/, '') || 'screenshot';
  return `${base}.${ext}`;
}

/** Resize and compress an image client-side before upload (matches server max 1920px). */
export async function compressImageFile(file: File): Promise<File> {
  const img = await loadImageFromFile(file);
  const { width, height } = scaledDimensions(img.naturalWidth, img.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to compress image.');
  }

  ctx.drawImage(img, 0, 0, width, height);

  try {
    const webpBlob = await canvasToBlob(canvas, 'image/webp', WEBP_QUALITY);
    return new File([webpBlob], replaceExtension(file.name, 'webp'), { type: 'image/webp' });
  } catch {
    const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    return new File([jpegBlob], replaceExtension(file.name, 'jpg'), { type: 'image/jpeg' });
  }
}
