/**
 * Generates PWA icons from public/images/nucleas-logo.png
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const logoPath = path.join(root, 'public', 'images', 'nucleas-logo.png');
const outDir = path.join(root, 'public', 'icons');
const BG = '#202938';

async function composeIcon(size, logoScale) {
    const logoSize = Math.round(size * logoScale);
    const logo = await sharp(logoPath)
        .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

    const left = Math.round((size - logoSize) / 2);
    const top = Math.round((size - logoSize) / 2);

    return sharp({
        create: {
            width: size,
            height: size,
            channels: 4,
            background: BG,
        },
    })
        .composite([{ input: logo, left, top }])
        .png()
        .toBuffer();
}

await mkdir(outDir, { recursive: true });

const icon192 = await composeIcon(192, 0.72);
const icon512 = await composeIcon(512, 0.72);
const icon512Maskable = await composeIcon(512, 0.58);

await sharp(icon192).toFile(path.join(outDir, 'pwa-192.png'));
await sharp(icon512).toFile(path.join(outDir, 'pwa-512.png'));
await sharp(icon512Maskable).toFile(path.join(outDir, 'pwa-512-maskable.png'));

console.log('Generated public/icons/pwa-192.png, pwa-512.png, pwa-512-maskable.png');
