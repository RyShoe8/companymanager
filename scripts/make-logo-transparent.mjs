/**
 * Removes the baked-in dark background from nucleas-logo.png so the atom
 * graphic blends with hero/footer surfaces. Re-run after replacing the source asset.
 *
 * Usage: node scripts/make-logo-transparent.mjs
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logoPath = path.join(__dirname, '../public/images/nucleas-logo.png');

function sampleBackgroundColor(data, width, height) {
  const samples = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [0, Math.floor(height / 2)],
  ];

  let r = 0;
  let g = 0;
  let b = 0;

  for (const [x, y] of samples) {
    const idx = (y * width + x) * 4;
    r += data[idx];
    g += data[idx + 1];
    b += data[idx + 2];
  }

  const n = samples.length;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function colorDistance(r, g, b, bg) {
  return Math.sqrt((r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2);
}

function removeBackground(data, width, height, bg) {
  const hardCutoff = 28;
  const softCutoff = 52;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dist = colorDistance(r, g, b, bg);

    if (dist <= hardCutoff) {
      data[i + 3] = 0;
      continue;
    }

    if (dist < softCutoff) {
      const factor = (dist - hardCutoff) / (softCutoff - hardCutoff);
      data[i + 3] = Math.round(data[i + 3] * factor);
    }
  }
}

async function main() {
  const { data, info } = await sharp(logoPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bg = sampleBackgroundColor(data, info.width, info.height);
  console.log(`Background sample: rgb(${bg.r}, ${bg.g}, ${bg.b})`);

  removeBackground(data, info.width, info.height, bg);

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 12 })
    .png({ compressionLevel: 9 })
    .toFile(logoPath);

  const meta = await sharp(logoPath).metadata();
  console.log(`Wrote transparent logo: ${logoPath} (${meta.width}x${meta.height})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
