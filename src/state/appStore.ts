import { create } from 'zustand';
import type {
  AudioFeedbackMode,
  LiftId,
  Recommendation,
  SetRecord,
  VelocityTarget,
} from '../domain/types';

export interface ActiveSetConfig {
  liftId: LiftId;
  loadKg: number;
  target: VelocityTarget;
  plannedReps?: number;
}

export interface AppState {
  audioMode: AudioFeedbackMode;
  setAudioMode: (mode: AudioFeedbackMode) => void;

  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;

  activeSet: ActiveSetConfig | null;
  setActiveSet: (cfg: ActiveSetConfig | null) => void;

  lastCompletedSet: SetRecord | null;
  lastRecommendation: Recommendation | null;
  setLastCompletedSet: (set: SetRecord | null, rec: Recommendation | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  audioMode: 'count_and_tone',
  setAudioMode: (mode) => set({ audioMode: mode }),

  activeSessionId: null,
  setActiveSessionId: (id) => set({ activeSessionId: id }),

  activeSet: null,
  setActiveSet: (cfg) => set({ activeSet: cfg }),

  lastCompletedSet: null,
  lastRecommendation: null,
  setLastCompletedSet: (s, rec) =>
    set({ lastCompletedSet: s, lastRecommendation: rec }),
}));
