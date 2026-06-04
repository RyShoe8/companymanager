import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Best-effort delete for files stored in Vercel Blob or local public/uploads.
 * No-ops for empty, pending, or data URLs.
 */
export async function deleteStoredFile(url: string | undefined | null): Promise<void> {
  const trimmed = url?.trim();
  if (!trimmed || trimmed === 'pending' || trimmed.startsWith('data:')) {
    return;
  }

  try {
    if (trimmed.startsWith('https://')) {
      const { del } = await import('@vercel/blob');
      await del(trimmed);
      return;
    }

    const localPath = trimmed.startsWith('/')
      ? join(process.cwd(), 'public', trimmed.replace(/^\//, ''))
      : join(process.cwd(), 'public', trimmed);

    if (existsSync(localPath)) {
      const { unlink } = await import('fs/promises');
      await unlink(localPath);
    }
  } catch (error) {
    console.error('deleteStoredFile failed:', trimmed, error);
  }
}
