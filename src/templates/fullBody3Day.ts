import type { WorkoutTemplate } from '../domain/types';
import { LIFTS } from '../domain/lifts';

export const FULL_BODY_3_DAY: WorkoutTemplate = {
  id: 'full-body-3-day',
  name: '3-Day Full Body (Velocity-Guided)',
  description:
    'Three sessions per week. Day A and B alternate strength and volume work on the four main lifts. Day C is variation day.',
  days: [
    {
      id: 'A',
      name: 'Day A — Squat strength + Bench volume',
      blocks: [
        {
          kind: 'barbell',
          liftId: 'squat',
          label: LIFTS.squat.name,
          mode: 'strength',
          suggestedTarget: LIFTS.squat.defaultRange,
          plannedSets: 4,
        },
        {
          kind: 'barbell',
          liftId: 'bench',
          label: LIFTS.bench.name,
          mode: 'volume',
          suggestedTarget: { kind: 'dropoff', thresholdPct: 0.2, plannedReps: 5 },
          plannedSets: 4,
        },
        { kind: 'placeholder', label: 'Row or pull-up — 3×8' },
        { kind: 'placeholder', label: 'Optional accessories' },
      ],
    },
    {
      id: 'B',
      name: 'Day B — Deadlift strength + OHP volume',
      blocks: [
        {
          kind: 'barbell',
          liftId: 'deadlift',
          label: LIFTS.deadlift.name,
          mode: 'strength',
          suggestedTarget: LIFTS.deadlift.defaultRange,
          plannedSets: 3,
        },
        {
          kind: 'barbell',
          liftId: 'ohp',
          label: LIFTS.ohp.name,
          mode: 'volume',
          suggestedTarget: { kind: 'dropoff', thresholdPct: 0.2, plannedReps: 5 },
          plannedSets: 4,
        },
        { kind: 'placeholder', label: 'Split squat or RDL — 3×8/side' },
        { kind: 'placeholder', label: 'Optional accessories' },
      ],
    },
    {
      id: 'C',
      name: 'Day C — Variation day',
      blocks: [
        {
          kind: 'placeholder',
          label: 'Squat variation (front squat / pause squat) — 4 sets',
        },
        {
          kind: 'placeholder',
          label: 'Bench variation (close-grip / incline) — 4 sets',
        },
        {
          kind: 'placeholder',
          label: 'Deadlift variation (speed pulls / deficit) — 3 sets',
        },
        { kind: 'placeholder', label: 'Optional accessories' },
      ],
    },
  ],
};

export const ALL_TEMPLATES = [FULL_BODY_3_DAY];
