export function downloadImage(src: string, filename: string): void {
  const ext = src.startsWith('data:image/webp') ? '.webp' : '';
  const safeName = filename.replace(/[^\w\s.-]/g, '').trim() || 'screenshot';
  const link = document.createElement('a');
  link.href = src;
  link.download = safeName.includes('.') ? safeName : `${safeName}${ext || '.webp'}`;
  link.click();
}
