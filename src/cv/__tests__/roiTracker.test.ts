import { describe, expect, it } from 'vitest';
import { createRoiTracker } from '../roiTracker';
import type { MarkerDetection } from '../markerTypes';

describe('createRoiTracker', () => {
  it('recenters the ROI around a detection', () => {
    const tracker = createRoiTracker({
      initialRoi: { x: 0, y: 0, width: 80, height: 80 },
      frameSize: { width: 320, height: 240 },
      paddingPx: 20,
    });

    const sample = tracker.push(detection(160, 100, 10));

    expect(sample.status).toBe('tracking');
    expect(sample.roi.x).toBeCloseTo(130);
    expect(sample.roi.y).toBeCloseTo(70);
    expect(sample.roi.width).toBeCloseTo(60);
  });

  it('reports lost after repeated misses and restored on a later detection', () => {
    const tracker = createRoiTracker({
      initialRoi: { x: 0, y: 0, width: 80, height: 80 },
      frameSize: { width: 320, height: 240 },
      maxMisses: 2,
    });

    expect(tracker.push(null).status).toBe('tracking');
    const lost = tracker.push(null);
    expect(lost.status).toBe('lost');
    expect(lost.justLost).toBe(true);

    const restored = tracker.push(detection(80, 80, 8));
    expect(restored.status).toBe('tracking');
    expect(restored.justRestored).toBe(true);
  });
});

function detection(cx: number, cy: number, radiusPx: number): MarkerDetection {
  return {
    cx,
    cy,
    radiusPx,
    score: 0.9,
    pixelCount: 200,
    roi: { x: 0, y: 0, width: 80, height: 80 },
  };
}
