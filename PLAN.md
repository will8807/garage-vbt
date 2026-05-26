# Garage VBT — MVP Plan

A mobile-first Velocity-Based Training app for solo garage lifters. The phone watches the bar, the app tells you what to do next — heavier, repeat, lighter, stop.

---

## 1. Technical Plan

### Tech stack
- **Vite + React + TypeScript** — fast iteration, mobile-first responsive UI, single codebase for now.
- **Vitest + @testing-library/react** — TDD for the decision engine; component tests later.
- **Zustand** — minimal global state (current session, audio mode, settings).
- **IndexedDB via `idb`** — durable local history (sessions, sets, reps, profiles).
- **Web Audio API + `speechSynthesis`** — hands-free audio feedback.
- **`getUserMedia` + `<input type="file" capture>`** — record or import a set video.
- **Recharts** — lightweight charts for history screen.
- **PWA manifest** — installable on iOS/Android home screen; Capacitor wrap later if needed.

### Core product loop — real-time
After each rep the lifter hears a tone telling them to keep going or stop. **The CV layer is streaming**, not post-hoc: frames in, `Rep` events out as each rep completes. Latency budget from rep completion to tone is **< 600ms**.

This affects platform choice: a PWA + `getUserMedia` is the MVP runtime, but native frame access (React Native + `react-native-vision-camera`, or Capacitor with a native plugin) will eventually be needed for reliable per-frame bar tracking. All non-UI modules are kept platform-independent so the engine, audio mapping, storage interface, and templates port 1:1.

### Module boundaries (each is replaceable in isolation)
1. `src/cv/` — Computer-vision adapter. **`LiveAnalyzer`** (streaming) is the primary interface; `VideoAnalyzer` (post-hoc) is kept only as a dev/debug affordance. Stub today, MediaPipe/OpenCV/native model later.
2. `src/decision/` — Pure functions over rep streams and history. No DOM, no audio, no storage.
3. `src/audio/` — Subscribes to decision events; emits tones + speech. No knowledge of UI.
4. `src/storage/` — `SessionRepository` interface; IndexedDB impl. Schema versioned.
5. `src/templates/` — Static workout templates (3-day full body).
6. `src/ui/` — React screens. Talks to modules through hooks; never reaches into internals.

### Mobile-first guardrails
- Single column, big tap targets (min 48px), bottom-anchored primary action.
- Audio-first flow during a set: screen can sleep, sound still plays.
- No coach voice. Numbers spoken short, tones <300ms.

---

## 2. Data Model

```ts
type LiftId = 'squat' | 'bench' | 'deadlift' | 'ohp';

type Lift = {
  id: LiftId;
  name: string;
  defaultRangeTarget: VelocityRangeTarget; // strength-speed default per lift
};

type VelocityRangeTarget = {
  kind: 'range';
  minMps: number;       // e.g. 0.45
  maxMps: number;       // e.g. 0.65
};

type VelocityDropoffTarget = {
  kind: 'dropoff';
  thresholdPct: number; // 0.10, 0.15, 0.20
  warnAtPct?: number;   // default = thresholdPct * 0.75
};

type VelocityTarget = VelocityRangeTarget | VelocityDropoffTarget;

type Rep = {
  index: number;              // 1-based within the set
  meanVelocityMps: number;
  peakVelocityMps: number;
  romMeters: number;
  confidence: number;         // 0..1
  timestampMs: number;
};

type SetRecord = {
  id: string;
  sessionId: string;
  liftId: LiftId;
  loadKg: number;
  target: VelocityTarget;
  reps: Rep[];
  bestMeanVelocityMps: number;
  stopReason: 'user' | 'dropoff' | 'failure' | 'complete';
  videoRef?: string;          // local blob URL or filename
  createdAt: number;
};

type Session = {
  id: string;
  startedAt: number;
  endedAt?: number;
  templateDay?: 'A' | 'B' | 'C';
  sets: SetRecord[];
  notes?: string;
};

type LoadVelocityPoint = { loadKg: number; meanVelocityMps: number };
type VelocityProfile = {
  liftId: LiftId;
  points: LoadVelocityPoint[];  // appended from completed sets
  estimatedTrainingMaxKg?: number;
};

type Recommendation = {
  action: 'add_weight' | 'repeat_weight' | 'reduce_weight' | 'stop_exercise';
  suggestedLoadKg?: number;
  reason: string;
};

type AudioFeedbackMode = 'count_and_tone' | 'tone_only' | 'count_only' | 'muted';

type WorkoutTemplate = {
  id: string;
  name: string;
  days: TemplateDay[];
};
type TemplateDay = {
  id: 'A' | 'B' | 'C';
  name: string;
  blocks: TemplateBlock[];
};
type TemplateBlock = {
  kind: 'barbell' | 'placeholder';
  liftId?: LiftId;
  label: string;                          // for placeholders
  mode?: 'strength' | 'volume';           // suggests target type
  suggestedTarget?: VelocityTarget;
};
```

---

## 3. Decision Engine Rules

The engine is a pure reducer: it takes the running `SetRecord` plus a new `Rep` and returns events. UI/audio subscribe to events.

### Events
```
REP_COMPLETED               { rep }
REP_IN_TARGET               { rep }
REP_OUTSIDE_TARGET          { rep, reason: 'below'|'above'|'dropoff' }
VELOCITY_DROPOFF_WARNING    { rep, currentDropPct, thresholdPct }
STOP_SET                    { reason: 'dropoff'|'failure' }
TRACKING_CONFIDENCE_LOW     { rep }
LOAD_RECOMMENDATION         { recommendation }
```

### Rules

**R1. Confidence gate.** If `rep.confidence < 0.6`, emit `TRACKING_CONFIDENCE_LOW` and exclude the rep from `bestMeanVelocityMps`. Still emit `REP_COMPLETED`. Do not apply range/dropoff classification.

**R2. Range mode.** Given `VelocityRangeTarget(minMps, maxMps)`:
- `meanV < minMps` → `REP_OUTSIDE_TARGET(reason='below')`. If two consecutive below-min reps, emit `STOP_SET(reason='failure')`.
- `meanV > maxMps` → `REP_OUTSIDE_TARGET(reason='above')` (still fine, just fast).
- otherwise → `REP_IN_TARGET`.

**R3. Drop-off mode.** Given `VelocityDropoffTarget(thresholdPct, warnAtPct)` and the set's running fastest valid rep `vBest`:
- First valid rep sets `vBest`. Emit `REP_IN_TARGET`.
- `drop = (vBest - meanV) / vBest`.
- `drop >= thresholdPct` → emit `REP_OUTSIDE_TARGET(reason='dropoff')` then `STOP_SET(reason='dropoff')`.
- `warnAtPct <= drop < thresholdPct` → emit `VELOCITY_DROPOFF_WARNING`. Still in target.
- otherwise → `REP_IN_TARGET`. Update `vBest` if `meanV > vBest`.

**R4. Post-set recommendation** (`computePostSetRecommendation(set, profile)`):
- Range mode:
  - Best rep below `minMps` and stop reason was failure → `reduce_weight` (−5%).
  - Best rep in range, set ended by user with ≥ planned reps → `repeat_weight`.
  - Best rep above `maxMps` (faster than target) → `add_weight` (+2.5%).
  - 3+ consecutive `reduce_weight` recommendations for the same lift in one session → `stop_exercise`.
- Drop-off mode:
  - Reps ≥ planned and stop was `dropoff` after planned-rep count → `repeat_weight`.
  - Reps < planned with `dropoff` very early (< ~50% of planned) → `reduce_weight`.
  - Reps ≥ planned with no drop-off triggered → `add_weight`.

**R5. Readiness comparison** (`computeReadiness(liftId, todayFirstSetBestV, history)`):
- Find prior sessions' first-set best velocity at the same load (±2.5kg).
- If today's value is ≥ 10% slower than the historical mean → `low` readiness.
- If today's value is ≥ 5% faster → `high` readiness.
- else `normal`.
- Low readiness reduces recommended working weight by 5% next set; high readiness allows +2.5%.

**R6. Working-weight recommendation** (`recommendWorkingLoad(liftId, profile, target)`):
- If `profile` has ≥ 2 load-velocity points spanning the target velocity, linearly interpolate the load that yields the target's `minMps` (range mode) or a strength-speed default 0.5 m/s (drop-off mode).
- Else use `estimatedTrainingMaxKg * lift-specific intensity factor` (squat 70%, bench 70%, deadlift 75%, OHP 65%).
- Else fall back to user-entered working weight from settings.

---

## 4. Audio Feedback Event Flow

```
decision.engine → eventBus → audio.feedback
                                     │
                                     ├── speech.sayNumber(rep.index)
                                     ├── tones.positive() / negative() / stop() / warn()
                                     └── respects AudioFeedbackMode
```

### Mapping
| Event                       | count_and_tone           | tone_only        | count_only       | muted |
|-----------------------------|--------------------------|------------------|------------------|-------|
| REP_COMPLETED               | say rep#                 | —                | say rep#         | —     |
| REP_IN_TARGET               | positive tone (short)    | positive tone    | —                | —     |
| REP_OUTSIDE_TARGET          | negative tone            | negative tone    | —                | —     |
| VELOCITY_DROPOFF_WARNING    | warn tone (low pulse)    | warn tone        | —                | —     |
| STOP_SET                    | distinct stop chord      | stop chord       | stop chord       | —     |
| TRACKING_CONFIDENCE_LOW     | brief buzz before count  | buzz             | buzz             | —     |

### Tone design (Web Audio API, all ≤ 300ms)
- **positive** — 880 Hz sine, 120ms.
- **negative** — 220 Hz square, 180ms.
- **warn** — two 440 Hz pulses, 80ms each, 80ms gap.
- **stop** — 660→330 Hz sweep, 280ms.
- **buzz** — 110 Hz sawtooth, 100ms (low-confidence prefix).

### Ordering rule
For a single rep, the audio sequence is always: `[buzz if low-conf]` → `[number if mode includes count]` → `[tone if mode includes tone]`. Total budget ~600ms so the lifter hears feedback before re-racking.

---

## 5. Task Checklist

### Phase 0 — Scaffold
- [ ] `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`
- [ ] `index.html` + PWA manifest
- [ ] Folder structure per module map

### Phase 1 — Domain & decision engine (TDD)
- [ ] `src/domain/types.ts` — all models
- [ ] `src/domain/lifts.ts` — four lifts + defaults
- [ ] `src/decision/events.ts` — event union types
- [ ] **Tests first**: `rangeMode.test.ts`, `dropoffMode.test.ts`, `confidence.test.ts`, `recommendation.test.ts`, `readiness.test.ts`
- [ ] Implement `decision/engine.ts`, `rangeMode.ts`, `dropoffMode.ts`, `recommendation.ts`, `readiness.ts`

### Phase 2 — CV stub
- [x] `src/cv/types.ts` — **`LiveAnalyzer`** (streaming, primary) + `VideoAnalyzer` (debug-only)
- [x] `src/cv/simulatedLiveAnalyzer.ts` — emits Rep events on a timer to wire engine + audio + UI
- [x] `src/cv/stubAnalyzer.ts` — post-hoc stub (kept for debug import-video flow)
- [ ] *Future:* real impl via MediaPipe / OpenCV.js (PWA) or `react-native-vision-camera` (RN)

### Phase 3 — Audio
- [ ] **Tests first**: `audio/__tests__/feedback.test.ts` — event-to-action mapping per mode
- [ ] `src/audio/tones.ts`, `src/audio/speech.ts`, `src/audio/feedback.ts`

### Phase 4 — Storage
- [ ] `src/storage/sessionRepository.ts` — IndexedDB schema v1
- [ ] Tests with fake-indexeddb

### Phase 5 — Templates
- [ ] `src/templates/fullBody3Day.ts`

### Phase 6 — UI shell
- [ ] Routes: Home, NewSession, LiftSetup, RecordSet, PostSet, History, Charts, Settings
- [ ] Mobile-first layout, install banner, audio-mode toggle
- [ ] Video record/import component
- [ ] Charts (training max, best velocity at load, session volume, per-set velocity trend)

### Phase 7 — Wiring & polish
- [ ] Hook decision engine ↔ audio feedback ↔ UI live during set playback
- [ ] First-run flow with template pick

---

## Out of scope for MVP
- Real CV / pose detection (stubbed via `simulatedLiveAnalyzer`)
- Native camera shell (RN/Capacitor wrap) — webcam + getUserMedia for MVP
- Cloud sync, accounts
- Coaching narration
- Per-lift form analysis
- Watch / wearable integration
