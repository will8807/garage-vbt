import {
  type Rep,
  type VelocityTarget,
  type SetStopReason,
  LOW_CONFIDENCE_THRESHOLD,
} from '../domain/types';
import type { DecisionEvent, StopReason } from './events';

export interface SetEngineOptions {
  target: VelocityTarget;
  lowConfidenceThreshold?: number;
}

export interface SetSnapshot {
  reps: Rep[];
  bestMeanVelocityMps: number;
  stopped: boolean;
  stopReason?: SetStopReason;
  consecutiveBelowMin: number;
}

export interface SetEngine {
  processRep(rep: Rep): DecisionEvent[];
  markUserStopped(): DecisionEvent[];
  getSnapshot(): SetSnapshot;
}

export function createSetEngine(opts: SetEngineOptions): SetEngine {
  const target = opts.target;
  const lowConfThreshold = opts.lowConfidenceThreshold ?? LOW_CONFIDENCE_THRESHOLD;

  const state: SetSnapshot = {
    reps: [],
    bestMeanVelocityMps: 0,
    stopped: false,
    consecutiveBelowMin: 0,
  };

  function processRep(rep: Rep): DecisionEvent[] {
    if (state.stopped) return [];

    const events: DecisionEvent[] = [];
    state.reps.push(rep);

    if (rep.confidence < lowConfThreshold) {
      events.push({ type: 'TRACKING_CONFIDENCE_LOW', rep });
      events.push({ type: 'REP_COMPLETED', rep });
      return events;
    }

    events.push({ type: 'REP_COMPLETED', rep });

    if (target.kind === 'range') {
      if (rep.meanVelocityMps > state.bestMeanVelocityMps) {
        state.bestMeanVelocityMps = rep.meanVelocityMps;
      }
      if (rep.meanVelocityMps < target.minMps) {
        events.push({ type: 'REP_OUTSIDE_TARGET', rep, reason: 'below' });
        state.consecutiveBelowMin += 1;
        if (state.consecutiveBelowMin >= 2) {
          state.stopped = true;
          state.stopReason = 'failure';
          events.push({ type: 'STOP_SET', reason: 'failure' });
        }
      } else if (rep.meanVelocityMps > target.maxMps) {
        events.push({ type: 'REP_OUTSIDE_TARGET', rep, reason: 'above' });
        state.consecutiveBelowMin = 0;
      } else {
        events.push({ type: 'REP_IN_TARGET', rep });
        state.consecutiveBelowMin = 0;
      }
      return events;
    }

    // drop-off mode
    if (state.bestMeanVelocityMps === 0) {
      state.bestMeanVelocityMps = rep.meanVelocityMps;
      events.push({ type: 'REP_IN_TARGET', rep });
      return events;
    }

    const vBest = state.bestMeanVelocityMps;
    const drop = (vBest - rep.meanVelocityMps) / vBest;
    const thresholdPct = target.thresholdPct;
    const warnAtPct = target.warnAtPct ?? thresholdPct * 0.75;

    if (drop >= thresholdPct) {
      events.push({ type: 'REP_OUTSIDE_TARGET', rep, reason: 'dropoff' });
      state.stopped = true;
      state.stopReason = 'dropoff';
      const stopEvent: DecisionEvent = { type: 'STOP_SET', reason: 'dropoff' as StopReason };
      events.push(stopEvent);
      return events;
    }

    if (rep.meanVelocityMps > vBest) {
      state.bestMeanVelocityMps = rep.meanVelocityMps;
    }

    if (drop >= warnAtPct) {
      events.push({
        type: 'VELOCITY_DROPOFF_WARNING',
        rep,
        currentDropPct: drop,
        thresholdPct,
      });
      events.push({ type: 'REP_IN_TARGET', rep });
    } else {
      events.push({ type: 'REP_IN_TARGET', rep });
    }

    return events;
  }

  function markUserStopped(): DecisionEvent[] {
    if (state.stopped) return [];
    state.stopped = true;
    state.stopReason = 'user';
    return [];
  }

  function getSnapshot(): SetSnapshot {
    return {
      reps: [...state.reps],
      bestMeanVelocityMps: state.bestMeanVelocityMps,
      stopped: state.stopped,
      stopReason: state.stopReason,
      consecutiveBelowMin: state.consecutiveBelowMin,
    };
  }

  return { processRep, markUserStopped, getSnapshot };
}
