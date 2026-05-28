import { describe, expect, it } from 'vitest';
import { detectMarker } from '../markerDetector';
import type { MarkerConfig, RoiRect } from '../markerTypes';

const config: MarkerConfig = {
  diameterMm: 35,
  profile: 'neon_green',
  minRadiusPx: 2,
  maxRadiusPx: 20,
  minScore: 0.3,
};

describe('detectMarker', () => {
  it('finds a neon green blob and returns full-frame coordinates', () => {
    const roi: RoiRect = { x: 100, y: 50, width: 20, height: 20 };
    const image = makeImage(20, 20, (x, y) => {
      const dx = x - 9;
      const dy = y - 11;
      return Math.hypot(dx, dy) <= 4 ? [20, 235, 70, 255] : [8, 8, 8, 255];
    });

    const detection = detectMarker(image, roi, config);

    expect(detection).not.toBeNull();
    expect(detection!.cx).toBeCloseTo(109, 0);
    expect(detection!.cy).toBeCloseTo(61, 0);
    expect(detection!.radiusPx).toBeGreaterThan(3);
    expect(detection!.score).toBeGreaterThan(0.3);
  });

  it('returns null when no marker-colored pixels are present', () => {
    const image = makeImage(12, 12, () => [20, 20, 20, 255]);
    const detection = detectMarker(image, { x: 0, y: 0, width: 12, height: 12 }, config);

    expect(detection).toBeNull();
  });
});

function makeImage(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number, number],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data.set(pixel(x, y), i);
    }
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}
