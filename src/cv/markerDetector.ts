import type { MarkerConfig, MarkerDetection, RoiRect } from './markerTypes';

export interface MarkerDetectorOptions {
  previousCenter?: { x: number; y: number };
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function detectMarker(
  imageData: ImageData,
  roi: RoiRect,
  config: MarkerConfig,
  opts: MarkerDetectorOptions = {},
): MarkerDetection | null {
  const { width, height, data } = imageData;
  let pixelCount = 0;
  let sumX = 0;
  let sumY = 0;
  const bounds: Bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (!matchesMarker(data[i], data[i + 1], data[i + 2], config.profile)) {
        continue;
      }
      pixelCount += 1;
      sumX += x;
      sumY += y;
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
    }
  }

  if (pixelCount === 0) return null;

  const localCx = sumX / pixelCount;
  const localCy = sumY / pixelCount;
  const blobWidth = bounds.maxX - bounds.minX + 1;
  const blobHeight = bounds.maxY - bounds.minY + 1;
  const radiusPx = Math.sqrt(pixelCount / Math.PI);
  const circularity = Math.min(blobWidth, blobHeight) / Math.max(blobWidth, blobHeight);
  const fillRatio = pixelCount / Math.max(1, blobWidth * blobHeight);
  const proximity = opts.previousCenter
    ? scoreProximity(
        { x: roi.x + localCx, y: roi.y + localCy },
        opts.previousCenter,
        Math.max(roi.width, roi.height),
      )
    : 1;
  const radiusScore = scoreRadius(radiusPx, config.minRadiusPx, config.maxRadiusPx);
  const score = clamp01(
    radiusScore * 0.35 + circularity * 0.25 + Math.min(1, fillRatio * 2.5) * 0.2 + proximity * 0.2,
  );

  if (score < config.minScore) return null;

  return {
    cx: roi.x + localCx,
    cy: roi.y + localCy,
    radiusPx,
    score,
    pixelCount,
    roi,
  };
}

function matchesMarker(r: number, g: number, b: number, profile: MarkerConfig['profile']): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;

  if (profile === 'reflective') {
    return max >= 210 && chroma <= 70;
  }

  if (profile === 'neon_orange') {
    return r >= 180 && g >= 75 && g <= 210 && b <= 95 && r - b >= 110;
  }

  return g >= 150 && r <= 120 && b <= 150 && g - Math.max(r, b) >= 45;
}

function scoreRadius(radius: number, min: number, max: number): number {
  if (radius < min || radius > max) return 0;
  const center = (min + max) / 2;
  const halfRange = (max - min) / 2;
  return clamp01(1 - Math.abs(radius - center) / Math.max(1, halfRange));
}

function scoreProximity(
  current: { x: number; y: number },
  previous: { x: number; y: number },
  maxDistance: number,
): number {
  const dx = current.x - previous.x;
  const dy = current.y - previous.y;
  return clamp01(1 - Math.hypot(dx, dy) / Math.max(1, maxDistance));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
