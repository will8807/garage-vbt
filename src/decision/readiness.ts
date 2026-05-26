import type { LoadVelocityPoint, ReadinessAssessment } from '../domain/types';

const LOW_DELTA = -0.10;
const HIGH_DELTA = 0.05;
const LOAD_WINDOW_KG = 2.5;

export interface ReadinessInputs {
  todayLoadKg: number;
  todayMps: number;
  history: LoadVelocityPoint[];
}

export function computeReadiness(input: ReadinessInputs): ReadinessAssessment {
  const matches = input.history.filter(
    (p) => Math.abs(p.loadKg - input.todayLoadKg) <= LOAD_WINDOW_KG,
  );
  if (matches.length === 0) {
    return {
      readiness: 'normal',
      todayMps: input.todayMps,
      deltaPct: 0,
    };
  }

  const mean = matches.reduce((s, p) => s + p.meanVelocityMps, 0) / matches.length;
  const delta = (input.todayMps - mean) / mean;

  let readiness: ReadinessAssessment['readiness'] = 'normal';
  if (delta <= LOW_DELTA) readiness = 'low';
  else if (delta >= HIGH_DELTA) readiness = 'high';

  return {
    readiness,
    comparedAgainstMps: mean,
    todayMps: input.todayMps,
    deltaPct: delta,
  };
}
