export type LiftId = 'squat' | 'bench' | 'deadlift' | 'ohp';

export interface Lift {
  id: LiftId;
  name: string;
  shortName: string;
  defaultRange: VelocityRangeTarget;
  intensityFactor: number;
}

export interface VelocityRangeTarget {
  kind: 'range';
  minMps: number;
  maxMps: number;
}

export interface VelocityDropoffTarget {
  kind: 'dropoff';
  thresholdPct: number;
  warnAtPct?: number;
  plannedReps?: number;
}

export type VelocityTarget = VelocityRangeTarget | VelocityDropoffTarget;

export interface Rep {
  index: number;
  meanVelocityMps: number;
  peakVelocityMps: number;
  romMeters: number;
  confidence: number;
  timestampMs: number;
}

export type SetStopReason = 'user' | 'dropoff' | 'failure' | 'complete';

export interface SetRecord {
  id: string;
  sessionId: string;
  liftId: LiftId;
  loadKg: number;
  target: VelocityTarget;
  reps: Rep[];
  bestMeanVelocityMps: number;
  stopReason: SetStopReason;
  videoRef?: string;
  createdAt: number;
}

export interface Session {
  id: string;
  startedAt: number;
  endedAt?: number;
  templateDay?: 'A' | 'B' | 'C';
  sets: SetRecord[];
  notes?: string;
}

export interface LoadVelocityPoint {
  loadKg: number;
  meanVelocityMps: number;
  sessionId: string;
  timestampMs: number;
}

export interface VelocityProfile {
  liftId: LiftId;
  points: LoadVelocityPoint[];
  estimatedTrainingMaxKg?: number;
}

export type RecommendationAction =
  | 'add_weight'
  | 'repeat_weight'
  | 'reduce_weight'
  | 'stop_exercise';

export interface Recommendation {
  action: RecommendationAction;
  suggestedLoadKg?: number;
  reason: string;
}

export type AudioFeedbackMode =
  | 'count_and_tone'
  | 'tone_only'
  | 'count_only'
  | 'muted';

export type Readiness = 'low' | 'normal' | 'high';

export interface ReadinessAssessment {
  readiness: Readiness;
  comparedAgainstMps?: number;
  todayMps: number;
  deltaPct: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string;
  days: TemplateDay[];
}

export interface TemplateDay {
  id: 'A' | 'B' | 'C';
  name: string;
  blocks: TemplateBlock[];
}

export type TemplateBlockKind = 'barbell' | 'placeholder';

export interface TemplateBlock {
  kind: TemplateBlockKind;
  liftId?: LiftId;
  label: string;
  mode?: 'strength' | 'volume';
  suggestedTarget?: VelocityTarget;
  plannedSets?: number;
}

export const LOW_CONFIDENCE_THRESHOLD = 0.6;
