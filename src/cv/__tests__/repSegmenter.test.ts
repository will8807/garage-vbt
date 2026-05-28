import { describe, expect, it } from 'vitest';
import { createRepSegmenter } from '../repSegmenter';
import type { VelocitySample } from '../markerTypes';

describe('createRepSegmenter', () => {
  it('emits a rep after descent, bottom, ascent, and top', () => {
    const segmenter = createRepSegmenter({
      startPhase: 'top',
      velocityThresholdMps: 0.08,
      zeroThresholdMps: 0.03,
      stableFrames: 2,
    });
    const velocities = [
      0, 0,
      -0.12, -0.18, -0.14,
      0.01, 0,
      0.18, 0.25, 0.2,
      0.01, 0,
    ];

    const reps = velocities
      .map((v, i) => segmenter.push(sample(v, i)))
      .filter(Boolean);

    expect(reps).toHaveLength(1);
    expect(reps[0]!.index).toBe(1);
    expect(reps[0]!.meanVelocityMps).toBeGreaterThan(0.1);
    expect(reps[0]!.confidence).toBe(0.9);
  });
});

function sample(velocityMps: number, i: number): VelocitySample {
  return {
    tMs: i * 100,
    positionMeters: i * velocityMps * 0.1,
    velocityMps,
    confidence: 0.9,
  };
}
