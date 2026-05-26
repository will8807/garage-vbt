import { describe, it, expect, beforeEach } from 'vitest';
import { createSetEngine } from '../engine';
import { makeRep, range, resetRepCounter } from './helpers';

describe('decision engine — low-confidence reps', () => {
  beforeEach(resetRepCounter);

  it('emits TRACKING_CONFIDENCE_LOW for reps below the threshold', () => {
    const engine = createSetEngine({ target: range(0.45, 0.65) });
    const events = engine.processRep(
      makeRep({ meanVelocityMps: 0.55, confidence: 0.4 }),
    );
    expect(events.find((e) => e.type === 'TRACKING_CONFIDENCE_LOW')).toBeDefined();
  });

  it('still emits REP_COMPLETED for low-confidence reps', () => {
    const engine = createSetEngine({ target: range(0.45, 0.65) });
    const events = engine.processRep(
      makeRep({ meanVelocityMps: 0.55, confidence: 0.4 }),
    );
    expect(events.find((e) => e.type === 'REP_COMPLETED')).toBeDefined();
  });

  it('does not classify low-confidence reps as in/outside target', () => {
    const engine = createSetEngine({ target: range(0.45, 0.65) });
    const events = engine.processRep(
      makeRep({ meanVelocityMps: 0.30, confidence: 0.4 }),
    );
    expect(events.find((e) => e.type === 'REP_IN_TARGET')).toBeUndefined();
    expect(events.find((e) => e.type === 'REP_OUTSIDE_TARGET')).toBeUndefined();
  });

  it('excludes low-confidence reps from best-velocity tracking', () => {
    const engine = createSetEngine({ target: range(0.4, 0.7) });
    engine.processRep(makeRep({ meanVelocityMps: 0.55, confidence: 0.9 }));
    engine.processRep(makeRep({ meanVelocityMps: 0.95, confidence: 0.3 })); // high but low conf
    expect(engine.getSnapshot().bestMeanVelocityMps).toBeCloseTo(0.55);
  });
});
