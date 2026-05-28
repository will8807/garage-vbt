import type { Rep } from '../domain/types';
import type { LiftStartPhase } from './types';
import type { VelocitySample } from './markerTypes';

export interface RepSegmenterOptions {
  startPhase: LiftStartPhase;
  velocityThresholdMps?: number;
  zeroThresholdMps?: number;
  stableFrames?: number;
}

export interface RepSegmenter {
  push(sample: VelocitySample): Rep | null;
  getState(): RepSegmenterState;
}

export type RepSegmenterState = 'idle' | 'armed' | 'descent' | 'bottom' | 'ascent' | 'top';

export function createRepSegmenter(opts: RepSegmenterOptions): RepSegmenter {
  const threshold = opts.velocityThresholdMps ?? 0.08;
  const zero = opts.zeroThresholdMps ?? 0.04;
  const stableFrames = opts.stableFrames ?? 3;
  let state: RepSegmenterState = 'idle';
  let repIndex = 0;
  let stableCount = 0;
  let ascentSamples: VelocitySample[] = [];
  let repPositions: number[] = [];

  return {
    push(sample) {
      if (sample.confidence < 0.25) return null;
      repPositions.push(sample.positionMeters);
      if (repPositions.length > 180) repPositions.shift();

      if (state === 'idle') {
        stableCount = Math.abs(sample.velocityMps) <= zero ? stableCount + 1 : 0;
        if (stableCount >= stableFrames) state = 'armed';
        return null;
      }

      if (state === 'armed') {
        if (opts.startPhase === 'bottom' && sample.velocityMps > threshold) {
          state = 'ascent';
          ascentSamples = [sample];
        } else if (sample.velocityMps < -threshold) {
          state = 'descent';
        }
        return null;
      }

      if (state === 'descent') {
        if (Math.abs(sample.velocityMps) <= zero) {
          stableCount += 1;
          if (stableCount >= stableFrames) {
            state = 'bottom';
            stableCount = 0;
          }
        } else {
          stableCount = 0;
        }
        return null;
      }

      if (state === 'bottom') {
        if (sample.velocityMps > threshold) {
          state = 'ascent';
          ascentSamples = [sample];
        }
        return null;
      }

      if (state === 'ascent') {
        ascentSamples.push(sample);
        if (Math.abs(sample.velocityMps) <= zero) {
          stableCount += 1;
          if (stableCount >= stableFrames) {
            repIndex += 1;
            const rep = buildRep(repIndex, ascentSamples, repPositions);
            state = 'top';
            stableCount = 0;
            ascentSamples = [];
            repPositions = [];
            return rep;
          }
        } else {
          stableCount = 0;
        }
      }

      if (state === 'top' && sample.velocityMps < -threshold) {
        state = 'descent';
      }

      return null;
    },
    getState() {
      return state;
    },
  };
}

function buildRep(index: number, ascentSamples: VelocitySample[], positions: number[]): Rep {
  const velocities = ascentSamples.map((s) => Math.max(0, s.velocityMps));
  const meanVelocityMps = average(velocities);
  const peakVelocityMps = Math.max(...velocities, 0);
  const confidence = average(ascentSamples.map((s) => s.confidence));
  const minPos = Math.min(...positions);
  const maxPos = Math.max(...positions);
  return {
    index,
    meanVelocityMps: round(meanVelocityMps),
    peakVelocityMps: round(peakVelocityMps),
    romMeters: round(Math.abs(maxPos - minPos)),
    confidence: round(confidence),
    timestampMs: ascentSamples[ascentSamples.length - 1]?.tMs ?? Date.now(),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
