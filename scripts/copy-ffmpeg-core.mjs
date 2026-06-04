import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'ffmpeg');

const coreCopies = [
  {
    from: join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd', 'ffmpeg-core.js'),
    to: join(outDir, 'ffmpeg-core.js'),
  },
  {
    from: join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd', 'ffmpeg-core.wasm'),
    to: join(outDir, 'ffmpeg-core.wasm'),
  },
];

const esmDir = join(root, 'node_modules', '@ffmpeg', 'ffmpeg', 'dist', 'esm');

await mkdir(outDir, { recursive: true });

for (const { from, to } of coreCopies) {
  await copyFile(from, to);
  console.log(`Copied ${to.replace(root, '.')}`);
}

const esmFiles = (await readdir(esmDir)).filter((name) => name.endsWith('.js'));
for (const name of esmFiles) {
  const from = join(esmDir, name);
  const to = join(outDir, name);
  await copyFile(from, to);
  console.log(`Copied ${to.replace(root, '.')}`);
}
