import { describe, expect, it } from 'vitest';
import { clampCropRect, isValidCropRect, MIN_CROP_SIZE } from '@/lib/cropImageFile';

describe('cropImageFile helpers', () => {
  it('clamps rect to image bounds', () => {
    expect(clampCropRect({ x: -10, y: -5, width: 200, height: 150 }, 100, 80)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 80,
    });
  });

  it('shrinks width and height when rect extends past image edge', () => {
    expect(clampCropRect({ x: 90, y: 70, width: 50, height: 40 }, 100, 80)).toEqual({
      x: 90,
      y: 70,
      width: 10,
      height: 10,
    });
  });

  it('validates minimum crop size', () => {
    expect(isValidCropRect({ x: 0, y: 0, width: MIN_CROP_SIZE, height: MIN_CROP_SIZE })).toBe(true);
    expect(isValidCropRect({ x: 0, y: 0, width: MIN_CROP_SIZE - 1, height: 20 })).toBe(false);
    expect(isValidCropRect({ x: 0, y: 0, width: 20, height: MIN_CROP_SIZE - 1 })).toBe(false);
  });
});
