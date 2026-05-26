import { openDB, type IDBPDatabase } from 'idb';
import type { Session, SetRecord, VelocityProfile, LiftId } from '../domain/types';

const DB_NAME = 'garage-vbt';
const DB_VERSION = 1;

interface DbSchema {
  sessions: Session;
  profiles: VelocityProfile;
}

export interface SessionRepository {
  saveSession(session: Session): Promise<void>;
  getSession(id: string): Promise<Session | undefined>;
  listSessions(): Promise<Session[]>;
  appendSet(sessionId: string, set: SetRecord): Promise<void>;
  endSession(sessionId: string, endedAt: number): Promise<void>;
  getProfile(liftId: LiftId): Promise<VelocityProfile | undefined>;
  saveProfile(profile: VelocityProfile): Promise<void>;
  clear(): Promise<void>;
}

type DB = IDBPDatabase<unknown>;

let dbPromise: Promise<DB> | null = null;

function getDb(): Promise<DB> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) {
          const store = db.createObjectStore('sessions', { keyPath: 'id' });
          store.createIndex('startedAt', 'startedAt');
        }
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'liftId' });
        }
      },
    });
  }
  return dbPromise;
}

export function createSessionRepository(): SessionRepository {
  async function saveSession(session: Session): Promise<void> {
    const db = await getDb();
    await db.put('sessions', session);
  }

  async function getSession(id: string): Promise<Session | undefined> {
    const db = await getDb();
    return (await db.get('sessions', id)) as Session | undefined;
  }

  async function listSessions(): Promise<Session[]> {
    const db = await getDb();
    const all = (await db.getAll('sessions')) as Session[];
    return all.sort((a, b) => b.startedAt - a.startedAt);
  }

  async function appendSet(sessionId: string, set: SetRecord): Promise<void> {
    const db = await getDb();
    const existing = (await db.get('sessions', sessionId)) as Session | undefined;
    if (!existing) {
      throw new Error(`Session ${sessionId} not found`);
    }
    existing.sets.push(set);
    await db.put('sessions', existing);

    const profileKey = set.liftId;
    const profile =
      ((await db.get('profiles', profileKey)) as VelocityProfile | undefined) ?? {
        liftId: profileKey,
        points: [],
      };
    profile.points.push({
      loadKg: set.loadKg,
      meanVelocityMps: set.bestMeanVelocityMps,
      sessionId,
      timestampMs: set.createdAt,
    });
    await db.put('profiles', profile);
  }

  async function endSession(sessionId: string, endedAt: number): Promise<void> {
    const db = await getDb();
    const existing = (await db.get('sessions', sessionId)) as Session | undefined;
    if (!existing) return;
    existing.endedAt = endedAt;
    await db.put('sessions', existing);
  }

  async function getProfile(liftId: LiftId): Promise<VelocityProfile | undefined> {
    const db = await getDb();
    return (await db.get('profiles', liftId)) as VelocityProfile | undefined;
  }

  async function saveProfile(profile: VelocityProfile): Promise<void> {
    const db = await getDb();
    await db.put('profiles', profile);
  }

  async function clear(): Promise<void> {
    const db = await getDb();
    await db.clear('sessions');
    await db.clear('profiles');
  }

  return {
    saveSession,
    getSession,
    listSessions,
    appendSet,
    endSession,
    getProfile,
    saveProfile,
    clear,
  };
}

export type { DbSchema };
