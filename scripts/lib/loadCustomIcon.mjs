import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { extractDominantFill } from './simpleIconColorize.mjs';

/**
 * Load a custom SVG override if present.
 * @returns {{ svg: string, hex: string | null } | null}
 */
export async function loadCustomIcon(customDir, id) {
  const customPath = join(customDir, `${id}.svg`);
  if (!existsSync(customPath)) return null;
  const svg = await readFile(customPath, 'utf8');
  return { svg, hex: extractDominantFill(svg) };
}

/** Load a custom raster icon (PNG) if present. */
export async function loadCustomRasterIcon(customDir, id) {
  const customPath = join(customDir, `${id}.png`);
  if (!existsSync(customPath)) return null;
  return readFile(customPath);
}
