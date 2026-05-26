import type { Rep, VelocityRangeTarget, VelocityDropoffTarget } from '../../domain/types';

let counter = 0;

export function makeRep(opts: Partial<Rep> & { meanVelocityMps: number }): Rep {
  counter += 1;
  return {
    index: opts.index ?? counter,
    meanVelocityMps: opts.meanVelocityMps,
    peakVelocityMps: opts.peakVelocityMps ?? opts.meanVelocityMps * 1.3,
    romMeters: opts.romMeters ?? 0.55,
    confidence: opts.confidence ?? 0.95,
    timestampMs: opts.timestampMs ?? counter * 2500,
  };
}

export function resetRepCounter(): void {
  counter = 0;
}

export const range = (minMps: number, maxMps: number): VelocityRangeTarget => ({
  kind: 'range',
  minMps,
  maxMps,
});

export const dropoff = (
  thresholdPct: number,
  opts: { warnAtPct?: number; plannedReps?: number } = {},
): VelocityDropoffTarget => ({
  kind: 'dropoff',
  thresholdPct,
  warnAtPct: opts.warnAtPct,
  plannedReps: opts.plannedReps,
});
