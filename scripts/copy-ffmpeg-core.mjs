import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'ffmpeg');

const copies = [
  {
    from: join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd', 'ffmpeg-core.js'),
    to: join(outDir, 'ffmpeg-core.js'),
  },
  {
    from: join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd', 'ffmpeg-core.wasm'),
    to: join(outDir, 'ffmpeg-core.wasm'),
  },
  {
    from: join(root, 'node_modules', '@ffmpeg', 'ffmpeg', 'dist', 'esm', 'worker.js'),
    to: join(outDir, 'worker.js'),
  },
];

await mkdir(outDir, { recursive: true });

for (const { from, to } of copies) {
  await copyFile(from, to);
  console.log(`Copied ${to.replace(root, '.')}`);
}
