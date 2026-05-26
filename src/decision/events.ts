import type { Rep, Recommendation } from '../domain/types';

export type OutsideReason = 'below' | 'above' | 'dropoff';
export type StopReason = 'dropoff' | 'failure';

export type DecisionEvent =
  | { type: 'REP_COMPLETED'; rep: Rep }
  | { type: 'REP_IN_TARGET'; rep: Rep }
  | { type: 'REP_OUTSIDE_TARGET'; rep: Rep; reason: OutsideReason }
  | {
      type: 'VELOCITY_DROPOFF_WARNING';
      rep: Rep;
      currentDropPct: number;
      thresholdPct: number;
    }
  | { type: 'STOP_SET'; reason: StopReason }
  | { type: 'TRACKING_CONFIDENCE_LOW'; rep: Rep }
  | { type: 'LOAD_RECOMMENDATION'; recommendation: Recommendation };

export type DecisionEventType = DecisionEvent['type'];
