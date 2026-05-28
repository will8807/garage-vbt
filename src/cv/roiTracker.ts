import { clampRoi, type MarkerDetection, type RoiRect } from './markerTypes';

export interface RoiTrackerOptions {
  initialRoi: RoiRect;
  frameSize: { width: number; height: number };
  paddingPx?: number;
  maxMisses?: number;
}

export interface RoiTrackerSample {
  roi: RoiRect;
  confidence: number;
  status: 'tracking' | 'lost';
  justLost: boolean;
  justRestored: boolean;
}

export interface RoiTracker {
  push(detection: MarkerDetection | null): RoiTrackerSample;
  getRoi(): RoiRect;
  getMisses(): number;
}

export function createRoiTracker(opts: RoiTrackerOptions): RoiTracker {
  const padding = opts.paddingPx ?? 36;
  const maxMisses = opts.maxMisses ?? 6;
  let roi = clampRoi(opts.initialRoi, opts.frameSize);
  let misses = 0;
  let wasLost = false;

  return {
    push(detection) {
      if (!detection) {
        misses += 1;
        const lost = misses >= maxMisses;
        const sample = {
          roi,
          confidence: lost ? 0 : Math.max(0.1, 1 - misses / maxMisses),
          status: lost ? 'lost' as const : 'tracking' as const,
          justLost: lost && !wasLost,
          justRestored: false,
        };
        wasLost = lost;
        return sample;
      }

      const diameter = Math.max(24, detection.radiusPx * 2 + padding * 2);
      roi = clampRoi(
        {
          x: detection.cx - diameter / 2,
          y: detection.cy - diameter / 2,
          width: diameter,
          height: diameter,
        },
        opts.frameSize,
      );
      misses = 0;
      const justRestored = wasLost;
      wasLost = false;
      return {
        roi,
        confidence: detection.score,
        status: 'tracking',
        justLost: false,
        justRestored,
      };
    },
    getRoi() {
      return roi;
    },
    getMisses() {
      return misses;
    },
  };
}
