function parseColorToRgb(color: string): [number, number, number] | null {
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some((n) => Number.isNaN(n))) return null;
      return [r, g, b];
    }
    return null;
  }

  const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
  }

  return null;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** True when background is light enough that white text/icons are hard to see. */
function isLightBackgroundColor(color: string): boolean {
  const rgb = parseColorToRgb(color);
  if (!rgb) return false;
  return relativeLuminance(rgb[0], rgb[1], rgb[2]) > 0.5;
}

/** Text classes for labels/icons on a solid project color card header. */
export function getProjectCardHeaderTextClass(displayColor: string): string {
  return isLightBackgroundColor(displayColor)
    ? 'text-gray-900 drop-shadow-sm'
    : 'text-white';
}
