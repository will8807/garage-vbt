import type { Lift, LiftId } from './types';

export const LIFTS: Record<LiftId, Lift> = {
  squat: {
    id: 'squat',
    name: 'Back Squat',
    shortName: 'Squat',
    defaultRange: { kind: 'range', minMps: 0.5, maxMps: 0.75 },
    intensityFactor: 0.7,
  },
  bench: {
    id: 'bench',
    name: 'Bench Press',
    shortName: 'Bench',
    defaultRange: { kind: 'range', minMps: 0.45, maxMps: 0.65 },
    intensityFactor: 0.7,
  },
  deadlift: {
    id: 'deadlift',
    name: 'Deadlift',
    shortName: 'Deadlift',
    defaultRange: { kind: 'range', minMps: 0.45, maxMps: 0.7 },
    intensityFactor: 0.75,
  },
  ohp: {
    id: 'ohp',
    name: 'Overhead Press',
    shortName: 'OHP',
    defaultRange: { kind: 'range', minMps: 0.4, maxMps: 0.6 },
    intensityFactor: 0.65,
  },
};

export const ALL_LIFTS: Lift[] = Object.values(LIFTS);
