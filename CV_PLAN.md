# Real CV - Sleeve-End Marker Tracking

Replace `simulatedLiveAnalyzer` with a real bar-velocity detector. The product ships with a known-size high-contrast marker that the lifter places on the end of the bar sleeve or collar face. The app tracks that marker through the camera preview: its known diameter gives pixel-to-meter scale, and its center y over time gives the bar velocity signal.

## Key decisions

- **Tracking target:** A shipped marker on the sleeve end/collar face, not the plate. This avoids false velocity from plate spin.
- **Marker design:** Start with a 35 mm circular neon/retroreflective sticker with a black outer ring and small center dot/crosshair. Include spares.
- **Scale reference:** Marker diameter is known, so the app does not need plate diameter for MVP.
- **Acquisition:** User taps the marker in the camera preview. The app creates a small region of interest (ROI) around that tap and locks onto the marker.
- **Runtime tracking:** Per-frame work stays inside the ROI. Use cheap threshold/blob tracking first; use heavier detection only for initial lock or reacquisition if needed.
- **Runtime:** PWA + `getUserMedia` for MVP. The tracking pipeline stays behind the existing `LiveAnalyzer` boundary so a native camera shell can swap in later.

## Module layout

All under `src/cv/`:

| File | Shape | Responsibility |
|---|---|---|
| `markerTypes.ts` | types/constants | Marker diameter, color profile, ROI config, tracker confidence types. |
| `markerDetector.ts` | pure: `ImageData + ROI -> MarkerDetection | null` | Threshold high-contrast marker pixels inside a cropped ROI, find blob/circle center, estimate radius and score. |
| `roiTracker.ts` | pure: stateful tracker | Keep the ROI centered on the marker, handle short misses, emit tracking confidence/lost/restored state. |
| `motionTracker.ts` | pure: stateful tracker | Accept marker detections + timestamps. Lock `pxPerMeter` from detected marker radius, smooth position, differentiate to velocity. |
| `repSegmenter.ts` | pure: state machine | Consume velocity samples. Detect descent -> bottom -> ascent -> top transitions. Emit `Rep` with mean concentric velocity, peak velocity, ROM. |
| `realLiveAnalyzer.ts` | implements `LiveAnalyzer` | Wires `MediaStream -> <video> -> canvas -> ROI ImageData` at ~30 fps. Plugs detector, ROI tracker, motion tracker, and segmenter together. |
| `debugOverlay.ts` | UI helper | Draw ROI, marker center, radius, confidence, velocity, and rep state on the live preview. |

Tests live next to each module (`__tests__/`). Pure modules (`markerDetector`, `roiTracker`, `motionTracker`, `repSegmenter`) are TDD-first against synthetic traces and fixture frames.

## Data flow

Setup:

```
user places marker on sleeve end
  -> camera preview opens
  -> user taps marker
  -> app creates initial ROI around tap
  -> markerDetector confirms marker radius/center
  -> motionTracker locks pxPerMeter from known marker diameter
```

Per frame:

```
camera frame
  -> crop current ROI
  -> markerDetector.detect(cropped ImageData, roi)
       -> {cx, cy, radiusPx, score} | null
  -> roiTracker.push(detection, t)
       -> recentered ROI + tracking confidence
  -> motionTracker.push(detection, t)
       -> smoothed y position + velocity_m_per_s
  -> repSegmenter.push(velocitySample)
       -> emits Rep on top-of-ascent
  -> onEvent({ type: 'rep', rep })
```

Detection failure marks samples low-confidence. Short misses are tolerated; several consecutive misses emit `tracking_lost`. Recovery emits `tracking_restored`. Rep segmentation should pause while tracking is lost.

## Marker Detection

The first implementation should avoid general object recognition:

1. Convert ROI pixels into a color space that separates brightness/color well enough for the marker profile.
2. Threshold for the marker fill color or brightness.
3. Find connected components/blobs.
4. Select the best blob by size, circularity, contrast against the black ring, and proximity to previous center.
5. Return center, radius estimate, score, and diagnostic reasons for rejection.

The detector should support two marker profiles:

- **Neon sticker:** HSV threshold for green/orange fill plus black-ring contrast.
- **Reflective sticker:** brightness threshold plus black-ring/edge contrast, useful when phone light or garage lighting makes the marker pop.

Avoid running full-frame circle detection in the hot path. If reacquisition is needed, scan a larger ROI first, then only fall back to full-frame search/debug mode.

## Rep Segmentation State Machine

Squat / bench / OHP start from the top; deadlift starts from the bottom. The segmenter is parameterized by the start phase.

```
IDLE
  -> ARMED    (stable marker + stable start position for a short window)
ARMED
  -> DESCENT  (velocity < -threshold for N frames)
DESCENT
  -> BOTTOM   (abs(velocity) < zero_threshold for K frames)
BOTTOM
  -> ASCENT   (velocity > +threshold for N frames)
             [start of concentric - begin collecting velocity samples]
ASCENT
  -> TOP      (abs(velocity) < zero_threshold for K frames OR position returns near start)
             [emit Rep with mean(ascent samples), peak(ascent), ROM = abs(max - min) pos]
TOP
  -> DESCENT  (next rep)
```

Confidence per rep combines:

- marker detection score across ascent frames,
- radius stability,
- ROI continuity / missed-frame count,
- smoothness of the velocity profile.

This confidence maps directly onto the existing decision-engine confidence gate.

## Phased Build

Each phase produces something verifiable end-to-end before the next starts.

### Phase 0 - CV contracts

- [ ] Define `MarkerConfig`, `MarkerDetection`, `VelocitySample`, ROI state, and debug event types
- [ ] Extend `LiveAnalysisStartInput` with real-CV config: marker diameter, acquisition point, lift start phase, debug mode
- [ ] Add persisted app settings for `useRealCvExperimental` and marker profile

**Verifies:** the app has a stable contract before camera/OpenCV/browser details enter the implementation.

### Phase 1 - Marker acquisition + debug overlay

- [ ] Build tap-to-select marker UX on a hidden/debug camera screen
- [ ] Implement `markerDetector.ts` against fixture images of the shipped marker
- [ ] Draw ROI, detected center, radius, score, and rejection reason on the preview
- [ ] User taps marker -> ROI locks and follows small hand movements

**Verifies:** the shipped marker is visible and detectable in real garage lighting.

### Phase 2 - ROI tracking + live velocity readout

- [ ] Implement `roiTracker.ts` with tests for short misses, drift, and reacquisition
- [ ] Implement `motionTracker.ts` with synthetic position traces of known velocity
- [ ] Lock `pxPerMeter` from marker radius after a stable detection window
- [ ] Debug screen shows `pxPerMeter`, tracking confidence, and live velocity
- [ ] User does a slow squat -> readout shows plausible descent/ascent velocities

**Verifies:** marker scale and velocity are stable enough for VBT feedback.

### Phase 3 - Rep segmenter + `LiveAnalyzer` wiring

- [ ] Implement `repSegmenter.ts` with tests for squat/bench/OHP/deadlift traces
- [ ] Implement `realLiveAnalyzer.ts` using the existing `LiveAnalyzer` interface
- [ ] Add Settings feature flag: "Use real CV (experimental)"
- [ ] `RecordSet` swaps simulated analyzer for real analyzer when enabled
- [ ] User does a set -> reps appear in the existing UI, decision engine and audio fire as today

**Verifies:** the existing decision/audio/storage pipeline works unchanged with real reps.

## Latency Budget

| Stage | Target |
|---|---|
| Frame capture -> ROI ImageData | <10 ms |
| Marker threshold/blob detection in ROI | <10 ms |
| ROI tracker + motion tracker | <5 ms |
| Rep segmenter | <2 ms |
| Rep complete -> `onEvent` | <10 ms |
| **Total CV path** | **<30 ms per frame** |
| Rep completion -> tone (incl. audio module) | **<600 ms** |

The ROI should normally be small enough that cheap marker tracking is comfortable on a phone. If the marker is lost, reacquisition can spend more time because rep segmentation is paused.

## Out of Scope for This Iteration

- Plate diameter entry or automatic plate-size inference
- Plate-face tracking
- Multi-plate loaded-bar discrimination
- ROM-based form analysis (depth, lockout)
- Native camera shell (RN / Capacitor)
- Recording video alongside CV
- Side-view tracking
- Markerless bar detection

## Open Questions

- Marker material: neon matte sticker, retroreflective sticker, or both profiles in the box?
- Marker shape: circular sticker vs. square fiducial-style marker.
- Acquisition UX: tap-to-lock only, or tap plus auto-confirm when radius is stable?
- Reacquisition UX: pause silently, buzz once, or show a clear visual warning during the set?
- Phone lighting: should the app recommend turning on the phone torch for reflective markers?
