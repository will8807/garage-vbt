import { useMemo } from 'react';
import { createSessionRepository, type SessionRepository } from '../storage';

let cached: SessionRepository | null = null;

export function useSessionRepo(): SessionRepository {
  return useMemo(() => {
    if (!cached) cached = createSessionRepository();
    return cached;
  }, []);
}
