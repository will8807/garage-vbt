import { describe, it, expect } from 'vitest';
import { computeReadiness } from '../readiness';
import type { LoadVelocityPoint } from '../../domain/types';

const pts = (...vs: Array<[number, number]>): LoadVelocityPoint[] =>
  vs.map(([loadKg, meanVelocityMps], i) => ({
    loadKg,
    meanVelocityMps,
    sessionId: `s${i}`,
    timestampMs: i * 86_400_000,
  }));

describe('readiness comparison', () => {
  it('returns normal when no prior history exists', () => {
    const r = computeReadiness({ todayLoadKg: 100, todayMps: 0.6, history: [] });
    expect(r.readiness).toBe('normal');
  });

  it('returns low when today is 10% or more slower than historical mean at same load', () => {
    const history = pts([100, 0.7], [100, 0.72]);
    const r = computeReadiness({ todayLoadKg: 100, todayMps: 0.60, history });
    expect(r.readiness).toBe('low');
  });

  it('returns high when today is 5% or more faster than historical mean at same load', () => {
    const history = pts([100, 0.7], [100, 0.68]);
    const r = computeReadiness({ todayLoadKg: 100, todayMps: 0.74, history });
    expect(r.readiness).toBe('high');
  });

  it('returns normal for small deltas', () => {
    const history = pts([100, 0.7]);
    const r = computeReadiness({ todayLoadKg: 100, todayMps: 0.69, history });
    expect(r.readiness).toBe('normal');
  });

  it('matches loads within ±2.5kg of today\'s load', () => {
    const history = pts([102.5, 0.7], [97.5, 0.72]);
    const r = computeReadiness({ todayLoadKg: 100, todayMps: 0.60, history });
    expect(r.readiness).toBe('low');
  });

  it('ignores history points outside the load window', () => {
    const history = pts([120, 0.5]); // much heavier, slower — should not anchor us
    const r = computeReadiness({ todayLoadKg: 100, todayMps: 0.6, history });
    expect(r.readiness).toBe('normal');
  });
});
