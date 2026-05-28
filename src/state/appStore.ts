import { create } from 'zustand';
import type {
  AudioFeedbackMode,
  LiftId,
  Recommendation,
  SetRecord,
  VelocityTarget,
} from '../domain/types';
import {
  DEFAULT_MARKER_DIAMETER_MM,
  type MarkerProfileId,
} from '../cv/markerTypes';

const SETTINGS_KEY = 'garage-vbt-settings-v1';

interface PersistedSettings {
  audioMode?: AudioFeedbackMode;
  useRealCvExperimental?: boolean;
  markerDiameterMm?: number;
  markerProfile?: MarkerProfileId;
}

function readSettings(): PersistedSettings {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) as PersistedSettings : {};
  } catch {
    return {};
  }
}

function writeSettings(patch: PersistedSettings) {
  if (typeof window === 'undefined') return;
  const next = { ...readSettings(), ...patch };
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

export interface ActiveSetConfig {
  liftId: LiftId;
  loadKg: number;
  target: VelocityTarget;
  plannedReps?: number;
}

export interface AppState {
  audioMode: AudioFeedbackMode;
  setAudioMode: (mode: AudioFeedbackMode) => void;

  useRealCvExperimental: boolean;
  setUseRealCvExperimental: (enabled: boolean) => void;

  markerDiameterMm: number;
  setMarkerDiameterMm: (diameterMm: number) => void;

  markerProfile: MarkerProfileId;
  setMarkerProfile: (profile: MarkerProfileId) => void;

  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;

  activeSet: ActiveSetConfig | null;
  setActiveSet: (cfg: ActiveSetConfig | null) => void;

  lastCompletedSet: SetRecord | null;
  lastRecommendation: Recommendation | null;
  setLastCompletedSet: (set: SetRecord | null, rec: Recommendation | null) => void;
}

const persisted = readSettings();

export const useAppStore = create<AppState>((set) => ({
  audioMode: persisted.audioMode ?? 'count_and_tone',
  setAudioMode: (mode) => {
    writeSettings({ audioMode: mode });
    set({ audioMode: mode });
  },

  useRealCvExperimental: persisted.useRealCvExperimental ?? false,
  setUseRealCvExperimental: (enabled) => {
    writeSettings({ useRealCvExperimental: enabled });
    set({ useRealCvExperimental: enabled });
  },

  markerDiameterMm: persisted.markerDiameterMm ?? DEFAULT_MARKER_DIAMETER_MM,
  setMarkerDiameterMm: (diameterMm) => {
    writeSettings({ markerDiameterMm: diameterMm });
    set({ markerDiameterMm: diameterMm });
  },

  markerProfile: persisted.markerProfile ?? 'neon_green',
  setMarkerProfile: (profile) => {
    writeSettings({ markerProfile: profile });
    set({ markerProfile: profile });
  },

  activeSessionId: null,
  setActiveSessionId: (id) => set({ activeSessionId: id }),

  activeSet: null,
  setActiveSet: (cfg) => set({ activeSet: cfg }),

  lastCompletedSet: null,
  lastRecommendation: null,
  setLastCompletedSet: (s, rec) =>
    set({ lastCompletedSet: s, lastRecommendation: rec }),
}));
