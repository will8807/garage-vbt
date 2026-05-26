import { describe, it, expect, beforeEach } from 'vitest';
import { createSetEngine } from '../engine';
import { makeRep, range, resetRepCounter } from './helpers';

describe('decision engine — velocity range mode', () => {
  beforeEach(resetRepCounter);

  it('emits REP_IN_TARGET for a rep inside the range', () => {
    const engine = createSetEngine({ target: range(0.45, 0.65) });
    const events = engine.processRep(makeRep({ meanVelocityMps: 0.55 }));
    expect(events.map((e) => e.type)).toEqual(['REP_COMPLETED', 'REP_IN_TARGET']);
  });

  it('emits REP_OUTSIDE_TARGET reason=above when faster than max', () => {
    const engine = createSetEngine({ target: range(0.45, 0.65) });
    const events = engine.processRep(makeRep({ meanVelocityMps: 0.80 }));
    const outside = events.find((e) => e.type === 'REP_OUTSIDE_TARGET');
    expect(outside).toBeDefined();
    expect(outside && outside.type === 'REP_OUTSIDE_TARGET' && outside.reason).toBe('above');
  });

  it('emits REP_OUTSIDE_TARGET reason=below when slower than min', () => {
    const engine = createSetEngine({ target: range(0.45, 0.65) });
    const events = engine.processRep(makeRep({ meanVelocityMps: 0.30 }));
    const outside = events.find((e) => e.type === 'REP_OUTSIDE_TARGET');
    expect(outside && outside.type === 'REP_OUTSIDE_TARGET' && outside.reason).toBe('below');
  });

  it('emits STOP_SET reason=failure on two consecutive below-min reps', () => {
    const engine = createSetEngine({ target: range(0.45, 0.65) });
    engine.processRep(makeRep({ meanVelocityMps: 0.55 }));
    engine.processRep(makeRep({ meanVelocityMps: 0.30 }));
    const events = engine.processRep(makeRep({ meanVelocityMps: 0.28 }));
    const stop = events.find((e) => e.type === 'STOP_SET');
    expect(stop && stop.type === 'STOP_SET' && stop.reason).toBe('failure');
  });

  it('does not stop the set when a single below-min rep is followed by an in-range rep', () => {
    const engine = createSetEngine({ target: range(0.45, 0.65) });
    engine.processRep(makeRep({ meanVelocityMps: 0.40 }));
    const events = engine.processRep(makeRep({ meanVelocityMps: 0.55 }));
    expect(events.find((e) => e.type === 'STOP_SET')).toBeUndefined();
  });

  it('tracks the best mean velocity in the set', () => {
    const engine = createSetEngine({ target: range(0.45, 0.65) });
    engine.processRep(makeRep({ meanVelocityMps: 0.55 }));
    engine.processRep(makeRep({ meanVelocityMps: 0.62 }));
    engine.processRep(makeRep({ meanVelocityMps: 0.48 }));
    expect(engine.getSnapshot().bestMeanVelocityMps).toBeCloseTo(0.62);
  });
});
