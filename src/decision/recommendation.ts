import type {
  Recommendation,
  SetRecord,
  VelocityProfile,
  LoadVelocityPoint,
} from '../domain/types';
import { LOW_CONFIDENCE_THRESHOLD } from '../domain/types';
import { LIFTS } from '../domain/lifts';

const ADD_STEP_PCT = 0.025;
const REDUCE_STEP_PCT = 0.05;

function roundLoad(kg: number): number {
  return Math.round(kg / 2.5) * 2.5;
}

function highConfidenceReps(set: SetRecord) {
  return set.reps.filter((r) => r.confidence >= LOW_CONFIDENCE_THRESHOLD);
}

export function computePostSetRecommendation(
  set: SetRecord,
  _profile: VelocityProfile,
): Recommendation {
  const reps = highConfidenceReps(set);
  if (reps.length === 0) {
    return {
      action: 'repeat_weight',
      suggestedLoadKg: set.loadKg,
      reason: 'Set had no confidently tracked reps — retry the same weight.',
    };
  }

  const bestV = Math.max(...reps.map((r) => r.meanVelocityMps));

  if (set.target.kind === 'range') {
    const { minMps, maxMps } = set.target;

    if (set.stopReason === 'failure' || bestV < minMps) {
      return {
        action: 'reduce_weight',
        suggestedLoadKg: roundLoad(set.loadKg * (1 - REDUCE_STEP_PCT)),
        reason: `Best rep (${bestV.toFixed(2)} m/s) was below the target range — drop the load ~5%.`,
      };
    }

    if (bestV > maxMps) {
      return {
        action: 'add_weight',
        suggestedLoadKg: roundLoad(set.loadKg * (1 + ADD_STEP_PCT)),
        reason: `Best rep (${bestV.toFixed(2)} m/s) was faster than target — add ~2.5%.`,
      };
    }

    return {
      action: 'repeat_weight',
      suggestedLoadKg: set.loadKg,
      reason: 'Best rep was inside the target range — repeat this load.',
    };
  }

  // drop-off mode
  const planned = set.target.plannedReps ?? 5;
  const completed = reps.length;

  if (set.stopReason === 'dropoff' && completed < planned * 0.5) {
    return {
      action: 'reduce_weight',
      suggestedLoadKg: roundLoad(set.loadKg * (1 - REDUCE_STEP_PCT)),
      reason: `Drop-off hit after only ${completed} reps — reduce load ~5%.`,
    };
  }

  if (set.stopReason === 'dropoff' && completed >= planned) {
    return {
      action: 'repeat_weight',
      suggestedLoadKg: set.loadKg,
      reason: `Hit ${completed} reps before drop-off — repeat this load.`,
    };
  }

  if (set.stopReason !== 'dropoff' && completed >= planned) {
    return {
      action: 'add_weight',
      suggestedLoadKg: roundLoad(set.loadKg * (1 + ADD_STEP_PCT)),
      reason: `Completed ${completed} reps without triggering drop-off — add ~2.5%.`,
    };
  }

  return {
    action: 'repeat_weight',
    suggestedLoadKg: set.loadKg,
    reason: 'Inconclusive set — repeat the same load.',
  };
}

export interface WorkingLoadInputs {
  liftId: SetRecord['liftId'];
  profile: VelocityProfile;
  target: SetRecord['target'];
  fallbackLoadKg?: number;
}

export function recommendWorkingLoad(input: WorkingLoadInputs): number | undefined {
  const { profile, target, liftId, fallbackLoadKg } = input;
  const targetMps =
    target.kind === 'range' ? target.minMps : 0.5;

  const points: LoadVelocityPoint[] = profile.points;
  if (points.length >= 2) {
    const sorted = [...points].sort((a, b) => a.loadKg - b.loadKg);
    const above = sorted.find((p) => p.meanVelocityMps <= targetMps);
    const below = [...sorted].reverse().find((p) => p.meanVelocityMps >= targetMps);
    if (above && below && above !== below) {
      const ratio =
        (below.meanVelocityMps - targetMps) /
        (below.meanVelocityMps - above.meanVelocityMps);
      const kg = below.loadKg + ratio * (above.loadKg - below.loadKg);
      return Math.round(kg / 2.5) * 2.5;
    }
  }

  if (profile.estimatedTrainingMaxKg) {
    const factor = LIFTS[liftId].intensityFactor;
    return Math.round((profile.estimatedTrainingMaxKg * factor) / 2.5) * 2.5;
  }

  return fallbackLoadKg;
}
