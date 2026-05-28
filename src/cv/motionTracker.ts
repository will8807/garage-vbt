import type { MarkerDetection, VelocitySample } from './markerTypes';

export interface MotionTrackerOptions {
  markerDiameterMm: number;
  smoothingAlpha?: number;
  stableRadiusSamples?: number;
  maxRadiusJitterPct?: number;
}

export interface MotionTracker {
  push(detection: MarkerDetection | null, tMs: number, confidence?: number): VelocitySample | null;
  isCalibrated(): boolean;
  getPxPerMeter(): number | null;
}

export function createMotionTracker(opts: MotionTrackerOptions): MotionTracker {
  const alpha = opts.smoothingAlpha ?? 0.35;
  const requiredSamples = opts.stableRadiusSamples ?? 8;
  const maxJitterPct = opts.maxRadiusJitterPct ?? 0.12;
  const markerDiameterMeters = opts.markerDiameterMm / 1000;
  const radii: number[] = [];
  let pxPerMeter: number | null = null;
  let smoothedY: number | null = null;
  let lastPositionMeters: number | null = null;
  let lastT: number | null = null;
  let lastVelocity = 0;

  return {
    push(detection, tMs, confidence = detection?.score ?? 0) {
      if (!detection) return null;

      if (pxPerMeter === null) {
        radii.push(detection.radiusPx);
        if (radii.length > requiredSamples) radii.shift();
        if (radii.length >= requiredSamples && isStable(radii, maxJitterPct)) {
          const radius = average(radii);
          pxPerMeter = (radius * 2) / markerDiameterMeters;
        } else {
          return null;
        }
      }

      smoothedY = smoothedY === null
        ? detection.cy
        : smoothedY * (1 - alpha) + detection.cy * alpha;
      const positionMeters = smoothedY / pxPerMeter;

      if (lastT === null || lastPositionMeters === null) {
        lastT = tMs;
        lastPositionMeters = positionMeters;
        return {
          tMs,
          positionMeters,
          velocityMps: 0,
          confidence,
        };
      }

      const dtSeconds = Math.max(0.001, (tMs - lastT) / 1000);
      const rawVelocity = (positionMeters - lastPositionMeters) / dtSeconds;
      lastVelocity = lastVelocity * 0.45 + rawVelocity * 0.55;
      lastT = tMs;
      lastPositionMeters = positionMeters;

      return {
        tMs,
        positionMeters,
        velocityMps: lastVelocity,
        confidence,
      };
    },
    isCalibrated() {
      return pxPerMeter !== null;
    },
    getPxPerMeter() {
      return pxPerMeter;
    },
  };
}

function isStable(values: number[], maxJitterPct: number): boolean {
  const mean = average(values);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (max - min) / Math.max(1, mean) <= maxJitterPct;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
