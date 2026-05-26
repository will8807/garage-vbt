import { describe, it, expect, beforeEach } from 'vitest';
import { createSetEngine } from '../engine';
import { dropoff, makeRep, resetRepCounter } from './helpers';

describe('decision engine — velocity drop-off mode', () => {
  beforeEach(resetRepCounter);

  it('first rep establishes baseline and is in target', () => {
    const engine = createSetEngine({ target: dropoff(0.2) });
    const events = engine.processRep(makeRep({ meanVelocityMps: 0.80 }));
    expect(events.map((e) => e.type)).toEqual(['REP_COMPLETED', 'REP_IN_TARGET']);
    expect(engine.getSnapshot().bestMeanVelocityMps).toBeCloseTo(0.80);
  });

  it('updates baseline if a later rep is faster', () => {
    const engine = createSetEngine({ target: dropoff(0.2) });
    engine.processRep(makeRep({ meanVelocityMps: 0.70 }));
    engine.processRep(makeRep({ meanVelocityMps: 0.85 }));
    expect(engine.getSnapshot().bestMeanVelocityMps).toBeCloseTo(0.85);
  });

  it('emits warning between warn threshold and stop threshold', () => {
    const engine = createSetEngine({
      target: dropoff(0.2, { warnAtPct: 0.15 }),
    });
    engine.processRep(makeRep({ meanVelocityMps: 1.0 }));
    const events = engine.processRep(makeRep({ meanVelocityMps: 0.83 })); // 17% drop
    const warn = events.find((e) => e.type === 'VELOCITY_DROPOFF_WARNING');
    expect(warn).toBeDefined();
    expect(events.find((e) => e.type === 'STOP_SET')).toBeUndefined();
  });

  it('emits STOP_SET when drop meets or exceeds threshold', () => {
    const engine = createSetEngine({ target: dropoff(0.2) });
    engine.processRep(makeRep({ meanVelocityMps: 1.0 }));
    engine.processRep(makeRep({ meanVelocityMps: 0.9 }));
    const events = engine.processRep(makeRep({ meanVelocityMps: 0.79 })); // 21% drop
    const outside = events.find((e) => e.type === 'REP_OUTSIDE_TARGET');
    expect(outside && outside.type === 'REP_OUTSIDE_TARGET' && outside.reason).toBe('dropoff');
    const stop = events.find((e) => e.type === 'STOP_SET');
    expect(stop && stop.type === 'STOP_SET' && stop.reason).toBe('dropoff');
  });

  it('default warn threshold is 75% of stop threshold when not provided', () => {
    const engine = createSetEngine({ target: dropoff(0.20) });
    engine.processRep(makeRep({ meanVelocityMps: 1.0 }));
    // 16% drop should warn (75% of 20% = 15%)
    const events = engine.processRep(makeRep({ meanVelocityMps: 0.84 }));
    expect(events.find((e) => e.type === 'VELOCITY_DROPOFF_WARNING')).toBeDefined();
  });

  it('after STOP_SET, the engine reports the set as stopped', () => {
    const engine = createSetEngine({ target: dropoff(0.2) });
    engine.processRep(makeRep({ meanVelocityMps: 1.0 }));
    engine.processRep(makeRep({ meanVelocityMps: 0.7 }));
    expect(engine.getSnapshot().stopped).toBe(true);
    expect(engine.getSnapshot().stopReason).toBe('dropoff');
  });
});
