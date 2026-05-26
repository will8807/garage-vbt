import type {
  LiveAnalyzer,
  LiveAnalyzerHandle,
  SyntheticLiveProfile,
} from './types';
import type { Rep } from '../domain/types';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT_PROFILE: SyntheticLiveProfile = {
  repCount: 5,
  startVelocity: 0.75,
  perRepDrop: 0.04,
  intervalMs: 2500,
  jitter: 0.03,
  confidence: 0.92,
  rom: 0.55,
};

/**
 * Stub live analyzer — fires synthetic Rep events on a timer so the rest
 * of the app (decision engine + audio + UI) can be wired up before the real
 * bar-tracking CV exists. Replace with a real implementation backed by
 * MediaPipe / OpenCV.js / react-native-vision-camera later.
 */
export function createSimulatedLiveAnalyzer(): LiveAnalyzer {
  return {
    async start(input, onEvent): Promise<LiveAnalyzerHandle> {
      const profile = { ...DEFAULT_PROFILE, ...(input.synthetic ?? {}) };
      const seed = profile.seed ?? Date.now() & 0xffffffff;
      const rng = mulberry32(seed);

      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let repIndex = 0;

      onEvent({ type: 'ready' });

      function scheduleNext() {
        if (cancelled || repIndex >= profile.repCount) {
          if (!cancelled) onEvent({ type: 'ended', reason: 'no_motion' });
          return;
        }
        timer = setTimeout(() => {
          if (cancelled) return;
          repIndex += 1;
          const noise = (rng() - 0.5) * 2 * (profile.jitter ?? 0);
          const meanV = Math.max(
            0.1,
            profile.startVelocity - (repIndex - 1) * profile.perRepDrop + noise,
          );
          const peakV = meanV * (1.25 + rng() * 0.1);
          const rep: Rep = {
            index: repIndex,
            meanVelocityMps: round(meanV),
            peakVelocityMps: round(peakV),
            romMeters: round((profile.rom ?? 0.55) + (rng() - 0.5) * 0.03),
            confidence: clamp01((profile.confidence ?? 0.9) + (rng() - 0.5) * 0.1),
            timestampMs: Date.now(),
          };
          onEvent({ type: 'rep', rep });
          scheduleNext();
        }, profile.intervalMs);
      }

      scheduleNext();

      return {
        async stop() {
          if (cancelled) return;
          cancelled = true;
          if (timer) clearTimeout(timer);
          onEvent({ type: 'ended', reason: 'user' });
        },
        isRunning() {
          return !cancelled && repIndex < profile.repCount;
        },
      };
    },
  };
}

function round(v: number) {
  return Math.round(v * 1000) / 1000;
}
function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
