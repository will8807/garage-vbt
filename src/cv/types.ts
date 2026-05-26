import type { Rep, LiftId } from '../domain/types';

/**
 * Streaming/real-time analyzer.
 *
 * Real implementation will consume a MediaStream (or native camera frames),
 * run pose/bar detection per frame, segment reps, and emit `Rep` events as
 * each rep completes. The stub variant simulates this on a timer for dev.
 *
 * The audio + decision engine subscribe to onRep; total budget from rep
 * completion to tone should stay under ~600ms.
 */

export interface LiveAnalysisStartInput {
  liftId: LiftId;
  /** Video stream from getUserMedia or, later, native camera bridge. */
  stream?: MediaStream;
  /** Used by the stub to generate fake reps deterministically. */
  synthetic?: SyntheticLiveProfile;
}

export interface SyntheticLiveProfile {
  repCount: number;
  startVelocity: number;
  perRepDrop: number;
  intervalMs: number;
  jitter?: number;
  confidence?: number;
  rom?: number;
  seed?: number;
}

export type LiveAnalyzerEvent =
  | { type: 'ready' }
  | { type: 'rep'; rep: Rep }
  | { type: 'tracking_lost' }
  | { type: 'tracking_restored' }
  | { type: 'ended'; reason: 'user' | 'no_motion' };

export interface LiveAnalyzerHandle {
  /** Stop analysis, release camera/timers. Idempotent. */
  stop(): Promise<void>;
  /** True while frames are being consumed. */
  isRunning(): boolean;
}

export interface LiveAnalyzer {
  start(
    input: LiveAnalysisStartInput,
    onEvent: (e: LiveAnalyzerEvent) => void,
  ): Promise<LiveAnalyzerHandle>;
}

// --- Legacy post-hoc shape kept for the import-video debugging affordance ---

export interface VideoAnalysisInput {
  source: Blob | File | { kind: 'synthetic'; seed?: number };
  liftId: LiftId;
}

export interface VideoAnalysisProgress {
  phase: 'loading' | 'analyzing' | 'finalizing';
  progress: number;
}

export interface VideoAnalysisResult {
  reps: Rep[];
  durationMs: number;
  notes?: string;
}

export interface VideoAnalyzer {
  analyze(
    input: VideoAnalysisInput,
    onProgress?: (p: VideoAnalysisProgress) => void,
  ): Promise<VideoAnalysisResult>;
}
