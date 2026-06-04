export function downloadImage(src: string, filename: string): void {
  const extFromFilename = filename.match(/(\.[a-zA-Z0-9]+)$/)?.[1] ?? '';
  const extFromData = src.startsWith('data:image/webp')
    ? '.webp'
    : src.startsWith('data:image/jpeg')
      ? '.jpg'
      : '';
  const safeName = filename.replace(/[^\w\s.-]/g, '').trim() || 'screenshot';
  const hasExt = /\.[^/.]+$/.test(safeName);
  const downloadName = hasExt
    ? safeName
    : `${safeName}${extFromFilename || extFromData || '.webp'}`;
  const link = document.createElement('a');
  link.href = src;
  link.download = downloadName;
  link.click();
}
