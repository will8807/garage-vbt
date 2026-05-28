export type MarkerProfileId = 'neon_green' | 'neon_orange' | 'reflective';

export interface MarkerConfig {
  diameterMm: number;
  profile: MarkerProfileId;
  minRadiusPx: number;
  maxRadiusPx: number;
  minScore: number;
}

export interface RoiRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MarkerDetection {
  cx: number;
  cy: number;
  radiusPx: number;
  score: number;
  pixelCount: number;
  roi: RoiRect;
  reason?: string;
}

export interface VelocitySample {
  tMs: number;
  positionMeters: number;
  velocityMps: number;
  confidence: number;
}

export const DEFAULT_MARKER_DIAMETER_MM = 35;

export const DEFAULT_MARKER_CONFIG: MarkerConfig = {
  diameterMm: DEFAULT_MARKER_DIAMETER_MM,
  profile: 'neon_green',
  minRadiusPx: 4,
  maxRadiusPx: 90,
  minScore: 0.45,
};

export function makeRoiAroundPoint(
  point: { x: number; y: number },
  size: number,
  bounds: { width: number; height: number },
): RoiRect {
  const width = Math.min(size, bounds.width);
  const height = Math.min(size, bounds.height);
  return clampRoi(
    {
      x: point.x - width / 2,
      y: point.y - height / 2,
      width,
      height,
    },
    bounds,
  );
}

export function clampRoi(
  roi: RoiRect,
  bounds: { width: number; height: number },
): RoiRect {
  const width = Math.max(1, Math.min(roi.width, bounds.width));
  const height = Math.max(1, Math.min(roi.height, bounds.height));
  return {
    x: clamp(roi.x, 0, bounds.width - width),
    y: clamp(roi.y, 0, bounds.height - height),
    width,
    height,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
