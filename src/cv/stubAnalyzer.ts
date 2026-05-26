import type {
  VideoAnalyzer,
  VideoAnalysisInput,
  VideoAnalysisProgress,
  VideoAnalysisResult,
} from './types';
import type { Rep } from '../domain/types';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface StubAnalyzerOptions {
  repCount?: number;
  startVelocity?: number;
  perRepDrop?: number;
  jitter?: number;
  confidence?: number;
  rom?: number;
  seed?: number;
  delayMs?: number;
}

export function createStubAnalyzer(defaults: StubAnalyzerOptions = {}): VideoAnalyzer {
  return {
    async analyze(
      input: VideoAnalysisInput,
      onProgress?: (p: VideoAnalysisProgress) => void,
    ): Promise<VideoAnalysisResult> {
      const seed =
        (typeof input.source === 'object' &&
          'kind' in input.source &&
          input.source.kind === 'synthetic' &&
          input.source.seed) ||
        defaults.seed ||
        Date.now() & 0xffffffff;
      const rng = mulberry32(seed);

      const repCount = defaults.repCount ?? 5;
      const startV = defaults.startVelocity ?? 0.7;
      const drop = defaults.perRepDrop ?? 0.03;
      const jitter = defaults.jitter ?? 0.02;
      const conf = defaults.confidence ?? 0.9;
      const rom = defaults.rom ?? 0.55;
      const delayMs = defaults.delayMs ?? 200;

      onProgress?.({ phase: 'loading', progress: 0.05 });
      await wait(delayMs);

      const reps: Rep[] = [];
      for (let i = 0; i < repCount; i += 1) {
        const noise = (rng() - 0.5) * 2 * jitter;
        const meanV = Math.max(0.1, startV - i * drop + noise);
        const peakV = meanV * (1.25 + rng() * 0.1);
        reps.push({
          index: i + 1,
          meanVelocityMps: round(meanV),
          peakVelocityMps: round(peakV),
          romMeters: round(rom + (rng() - 0.5) * 0.04),
          confidence: clamp01(conf + (rng() - 0.5) * 0.1),
          timestampMs: i * 2800,
        });
        onProgress?.({
          phase: 'analyzing',
          progress: 0.1 + 0.8 * ((i + 1) / repCount),
        });
        await wait(delayMs / 2);
      }

      onProgress?.({ phase: 'finalizing', progress: 0.95 });
      await wait(delayMs / 2);

      return {
        reps,
        durationMs: repCount * 2800,
        notes: 'stub analyzer — replace with real CV later',
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
function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
