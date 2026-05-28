import { describe, expect, it } from 'vitest';
import { createMotionTracker } from '../motionTracker';
import type { MarkerDetection } from '../markerTypes';

describe('createMotionTracker', () => {
  it('locks scale from stable marker radius and emits velocity', () => {
    const tracker = createMotionTracker({
      markerDiameterMm: 35,
      stableRadiusSamples: 3,
      smoothingAlpha: 1,
    });

    expect(tracker.push(detection(100, 100, 10), 0)).toBeNull();
    expect(tracker.push(detection(100, 100, 10), 16)).toBeNull();
    const first = tracker.push(detection(100, 100, 10), 32);
    expect(first).not.toBeNull();
    expect(tracker.getPxPerMeter()).toBeCloseTo(571.43, 1);

    const second = tracker.push(detection(100, 120, 10), 1032);
    expect(second!.velocityMps).toBeCloseTo(0.019, 2);
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
