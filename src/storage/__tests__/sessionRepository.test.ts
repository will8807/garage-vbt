import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { createSessionRepository } from '../sessionRepository';
import type { Session, SetRecord } from '../../domain/types';

const newSession = (id: string): Session => ({
  id,
  startedAt: Date.now(),
  sets: [],
});

const newSet = (id: string, sessionId: string, loadKg = 100): SetRecord => ({
  id,
  sessionId,
  liftId: 'squat',
  loadKg,
  target: { kind: 'range', minMps: 0.5, maxMps: 0.75 },
  reps: [
    {
      index: 1,
      meanVelocityMps: 0.6,
      peakVelocityMps: 0.8,
      romMeters: 0.55,
      confidence: 0.9,
      timestampMs: 0,
    },
  ],
  bestMeanVelocityMps: 0.6,
  stopReason: 'user',
  createdAt: Date.now(),
});

describe('session repository', () => {
  beforeEach(async () => {
    const repo = createSessionRepository();
    await repo.clear();
  });

  it('saves and retrieves a session', async () => {
    const repo = createSessionRepository();
    const session = newSession('s1');
    await repo.saveSession(session);
    const got = await repo.getSession('s1');
    expect(got?.id).toBe('s1');
  });

  it('appends a set and updates the velocity profile', async () => {
    const repo = createSessionRepository();
    const session = newSession('s2');
    await repo.saveSession(session);
    await repo.appendSet('s2', newSet('set1', 's2', 100));

    const got = await repo.getSession('s2');
    expect(got?.sets).toHaveLength(1);

    const profile = await repo.getProfile('squat');
    expect(profile?.points).toHaveLength(1);
    expect(profile?.points[0].loadKg).toBe(100);
  });

  it('lists sessions newest first', async () => {
    const repo = createSessionRepository();
    await repo.saveSession({ ...newSession('a'), startedAt: 100 });
    await repo.saveSession({ ...newSession('b'), startedAt: 300 });
    await repo.saveSession({ ...newSession('c'), startedAt: 200 });
    const list = await repo.listSessions();
    expect(list.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });
});
