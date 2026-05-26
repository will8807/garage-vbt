import { describe, it, expect } from 'vitest';
import { mapEventToActions } from '../feedback';
import type { DecisionEvent } from '../../decision/events';
import type { Rep } from '../../domain/types';

const rep = (index: number, confidence = 0.95): Rep => ({
  index,
  meanVelocityMps: 0.6,
  peakVelocityMps: 0.8,
  romMeters: 0.55,
  confidence,
  timestampMs: 0,
});

const completed = (r: Rep): DecisionEvent => ({ type: 'REP_COMPLETED', rep: r });
const inTarget = (r: Rep): DecisionEvent => ({ type: 'REP_IN_TARGET', rep: r });
const outside = (r: Rep): DecisionEvent => ({
  type: 'REP_OUTSIDE_TARGET',
  rep: r,
  reason: 'below',
});
const warn = (r: Rep): DecisionEvent => ({
  type: 'VELOCITY_DROPOFF_WARNING',
  rep: r,
  currentDropPct: 0.16,
  thresholdPct: 0.2,
});
const stop = (): DecisionEvent => ({ type: 'STOP_SET', reason: 'dropoff' });
const lowConf = (r: Rep): DecisionEvent => ({
  type: 'TRACKING_CONFIDENCE_LOW',
  rep: r,
});

function collect(events: DecisionEvent[], mode: Parameters<typeof mapEventToActions>[1]) {
  return events.flatMap((e) => mapEventToActions(e, mode));
}

describe('audio feedback — event to action mapping', () => {
  it('count_and_tone: rep completed announces number; in_target plays positive tone', () => {
    const actions = collect([completed(rep(3)), inTarget(rep(3))], 'count_and_tone');
    expect(actions.map((a) => a.kind)).toEqual(['speak_number', 'tone_positive']);
    expect(actions[0]).toMatchObject({ kind: 'speak_number', value: 3 });
  });

  it('tone_only: skips spoken number, plays only the tone', () => {
    const actions = collect([completed(rep(3)), inTarget(rep(3))], 'tone_only');
    expect(actions.map((a) => a.kind)).toEqual(['tone_positive']);
  });

  it('count_only: speaks number but no tone for in/outside target', () => {
    const actions = collect(
      [completed(rep(3)), outside(rep(3))],
      'count_only',
    );
    expect(actions.map((a) => a.kind)).toEqual(['speak_number']);
  });

  it('muted: produces no actions', () => {
    const actions = collect(
      [completed(rep(3)), inTarget(rep(3)), warn(rep(3)), stop()],
      'muted',
    );
    expect(actions).toHaveLength(0);
  });

  it('outside target emits negative tone', () => {
    const actions = collect([outside(rep(2))], 'tone_only');
    expect(actions[0]?.kind).toBe('tone_negative');
  });

  it('drop-off warning emits warn tone', () => {
    const actions = collect([warn(rep(4))], 'tone_only');
    expect(actions[0]?.kind).toBe('tone_warn');
  });

  it('stop_set emits stop tone in all non-muted modes', () => {
    for (const mode of ['count_and_tone', 'tone_only', 'count_only'] as const) {
      const actions = collect([stop()], mode);
      expect(actions[0]?.kind).toBe('tone_stop');
    }
  });

  it('low-confidence rep emits buzz before the number', () => {
    // Engine emits TRACKING_CONFIDENCE_LOW before REP_COMPLETED so the buzz
    // precedes the spoken number — see decision/engine.ts.
    const actions = collect(
      [lowConf(rep(2, 0.3)), completed(rep(2, 0.3))],
      'count_and_tone',
    );
    const kinds = actions.map((a) => a.kind);
    expect(kinds).toContain('tone_buzz');
    expect(kinds.indexOf('tone_buzz')).toBeLessThan(kinds.indexOf('speak_number'));
  });
});
