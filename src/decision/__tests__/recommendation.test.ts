import { describe, it, expect } from 'vitest';
import { computePostSetRecommendation } from '../recommendation';
import type { SetRecord, VelocityProfile } from '../../domain/types';

function setRecord(overrides: Partial<SetRecord> & { reps: SetRecord['reps'] }): SetRecord {
  const bestMean = overrides.bestMeanVelocityMps
    ?? Math.max(...overrides.reps.map((r) => r.meanVelocityMps));
  return {
    id: overrides.id ?? 's1',
    sessionId: overrides.sessionId ?? 'sess1',
    liftId: overrides.liftId ?? 'squat',
    loadKg: overrides.loadKg ?? 100,
    target: overrides.target ?? { kind: 'range', minMps: 0.5, maxMps: 0.75 },
    reps: overrides.reps,
    bestMeanVelocityMps: bestMean,
    stopReason: overrides.stopReason ?? 'user',
    createdAt: overrides.createdAt ?? Date.now(),
  };
}

const emptyProfile: VelocityProfile = { liftId: 'squat', points: [] };

const r = (mean: number) => ({
  index: 1,
  meanVelocityMps: mean,
  peakVelocityMps: mean * 1.3,
  romMeters: 0.55,
  confidence: 0.95,
  timestampMs: 0,
});

describe('post-set recommendation — range mode', () => {
  it('recommends reduce_weight when best rep is below range and the set failed', () => {
    const set = setRecord({
      reps: [r(0.55), r(0.45), r(0.40)],
      target: { kind: 'range', minMps: 0.5, maxMps: 0.75 },
      stopReason: 'failure',
    });
    const rec = computePostSetRecommendation(set, emptyProfile);
    expect(rec.action).toBe('reduce_weight');
    expect(rec.suggestedLoadKg).toBeLessThan(set.loadKg);
  });

  it('recommends repeat_weight when best rep is in range and stopped by user', () => {
    const set = setRecord({
      reps: [r(0.62), r(0.58), r(0.55)],
      target: { kind: 'range', minMps: 0.5, maxMps: 0.75 },
      stopReason: 'user',
    });
    const rec = computePostSetRecommendation(set, emptyProfile);
    expect(rec.action).toBe('repeat_weight');
    expect(rec.suggestedLoadKg).toBe(set.loadKg);
  });

  it('recommends add_weight when best rep is faster than the range max', () => {
    const set = setRecord({
      reps: [r(0.85), r(0.80)],
      target: { kind: 'range', minMps: 0.5, maxMps: 0.75 },
      stopReason: 'user',
    });
    const rec = computePostSetRecommendation(set, emptyProfile);
    expect(rec.action).toBe('add_weight');
    expect(rec.suggestedLoadKg).toBeGreaterThan(set.loadKg);
  });
});

describe('post-set recommendation — drop-off mode', () => {
  it('recommends repeat_weight when planned reps were completed before drop-off', () => {
    const set = setRecord({
      reps: [r(0.8), r(0.78), r(0.74), r(0.72), r(0.55)],
      target: { kind: 'dropoff', thresholdPct: 0.2, plannedReps: 4 },
      stopReason: 'dropoff',
    });
    const rec = computePostSetRecommendation(set, emptyProfile);
    expect(rec.action).toBe('repeat_weight');
  });

  it('recommends reduce_weight when drop-off triggers very early', () => {
    const set = setRecord({
      reps: [r(0.8), r(0.6)],
      target: { kind: 'dropoff', thresholdPct: 0.2, plannedReps: 6 },
      stopReason: 'dropoff',
    });
    const rec = computePostSetRecommendation(set, emptyProfile);
    expect(rec.action).toBe('reduce_weight');
  });

  it('recommends add_weight when planned reps completed without triggering drop-off', () => {
    const set = setRecord({
      reps: [r(0.8), r(0.78), r(0.77), r(0.76)],
      target: { kind: 'dropoff', thresholdPct: 0.2, plannedReps: 4 },
      stopReason: 'user',
    });
    const rec = computePostSetRecommendation(set, emptyProfile);
    expect(rec.action).toBe('add_weight');
  });
});
