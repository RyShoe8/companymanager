import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { put } from '@vercel/blob';
import type { PlatformStackType } from '@/lib/models/PlatformCategory';

export async function savePlatformIcon(
  stackType: PlatformStackType,
  optionId: string,
  content: Buffer,
  extension: 'svg' | 'png',
  contentType: string
): Promise<string> {
  const filename = `${optionId}.${extension}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`platform-icons/${stackType}/${filename}`, content, {
      access: 'public',
      contentType,
    });
    return blob.url;
  }

  const uploadsDir = join(process.cwd(), 'public', 'uploads', 'platform-icons', stackType);
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }
  const filepath = join(uploadsDir, filename);
  await writeFile(filepath, content);
  return `/uploads/platform-icons/${stackType}/${filename}`;
}
