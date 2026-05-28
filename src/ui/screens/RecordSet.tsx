import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../state/appStore';
import { useSessionRepo } from '../../state/useSessionRepo';
import { createSetEngine } from '../../decision/engine';
import { computePostSetRecommendation } from '../../decision/recommendation';
import type { DecisionEvent } from '../../decision/events';
import { createSimulatedLiveAnalyzer } from '../../cv/simulatedLiveAnalyzer';
import { createRealLiveAnalyzer } from '../../cv/realLiveAnalyzer';
import type { LiveAnalyzer, LiveAnalyzerHandle } from '../../cv/types';
import { createAudioFeedbackPlayer } from '../../audio/feedback';
import { tones, unlockAudio } from '../../audio/tones';
import { sayNumber } from '../../audio/speech';
import { LIFTS } from '../../domain/lifts';
import type { Rep, SetRecord, SetStopReason } from '../../domain/types';

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface LiveRep extends Rep {
  classification: 'in_target' | 'outside' | 'warn' | 'low_conf';
}

export function RecordSet() {
  const navigate = useNavigate();
  const repo = useSessionRepo();
  const activeSet = useAppStore((s) => s.activeSet);
  const audioMode = useAppStore((s) => s.audioMode);
  const useRealCvExperimental = useAppStore((s) => s.useRealCvExperimental);
  const markerDiameterMm = useAppStore((s) => s.markerDiameterMm);
  const markerProfile = useAppStore((s) => s.markerProfile);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const setLastCompletedSet = useAppStore((s) => s.setLastCompletedSet);

  const [reps, setReps] = useState<LiveRep[]>([]);
  const [status, setStatus] = useState<'idle' | 'live' | 'stopped'>('idle');
  const [stopReason, setStopReason] = useState<SetStopReason | undefined>();
  const [streamErr, setStreamErr] = useState<string | null>(null);
  const [markerPoint, setMarkerPoint] = useState<{ x: number; y: number } | null>(null);
  const [trackingState, setTrackingState] = useState<
    'simulated' | 'needs_marker' | 'acquiring' | 'tracking' | 'lost'
  >('simulated');

  const videoRef = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<LiveAnalyzerHandle | null>(null);
  const engineRef = useRef<ReturnType<typeof createSetEngine> | null>(null);
  const audioRef = useRef<ReturnType<typeof createAudioFeedbackPlayer> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!activeSet) {
      navigate('/new');
    }
  }, [activeSet, navigate]);

  useEffect(() => {
    audioRef.current = createAudioFeedbackPlayer({
      mode: audioMode,
      tones: {
        positive: tones.positive,
        negative: tones.negative,
        warn: tones.warn,
        stop: tones.stop,
        buzz: tones.buzz,
      },
      speak: sayNumber,
      unlockAudio,
    });
  }, [audioMode]);

  useEffect(() => {
    return () => {
      handleRef.current?.stop().catch(() => {/* ignore */});
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!activeSet) return null;

  const lift = LIFTS[activeSet.liftId];

  function classifyEvents(events: DecisionEvent[]): LiveRep['classification'] {
    if (events.some((e) => e.type === 'TRACKING_CONFIDENCE_LOW')) return 'low_conf';
    if (events.some((e) => e.type === 'REP_OUTSIDE_TARGET')) return 'outside';
    if (events.some((e) => e.type === 'VELOCITY_DROPOFF_WARNING')) return 'warn';
    if (events.some((e) => e.type === 'REP_IN_TARGET')) return 'in_target';
    return 'in_target';
  }

  async function handleRepEvents(events: DecisionEvent[]) {
    for (const event of events) {
      if (audioRef.current) await audioRef.current.handleEvent(event);
    }
  }

  async function startRecording() {
    setStreamErr(null);
    setReps([]);
    setStopReason(undefined);

    await unlockAudio();

    try {
      if (useRealCvExperimental && !streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    } catch (err) {
      setStreamErr(
        'Camera not available - running with simulated reps for dev. ' +
          (err instanceof Error ? err.message : ''),
      );
    }

    const canUseRealCv = useRealCvExperimental && Boolean(streamRef.current);

    if (canUseRealCv && !markerPoint) {
      setTrackingState('needs_marker');
      setStreamErr('Tap the sleeve-end marker in the camera preview, then start the set.');
      return;
    }

    setStatus('live');
    setTrackingState(canUseRealCv ? 'acquiring' : 'simulated');
    engineRef.current = createSetEngine({ target: activeSet!.target });

    const analyzer: LiveAnalyzer = canUseRealCv
      ? createRealLiveAnalyzer()
      : createSimulatedLiveAnalyzer();
    const handle = await analyzer.start(
      {
        liftId: activeSet!.liftId,
        stream: streamRef.current ?? undefined,
        realCv: canUseRealCv
          ? {
              markerDiameterMm,
              markerProfile,
              acquisitionPoint: markerPoint ?? undefined,
              debug: true,
            }
          : undefined,
        synthetic: {
          repCount: activeSet!.plannedReps ?? 5,
          startVelocity:
            activeSet!.target.kind === 'range'
              ? (activeSet!.target.minMps + activeSet!.target.maxMps) / 2 + 0.05
              : 0.85,
          perRepDrop: 0.04,
          intervalMs: 2400,
          confidence: 0.92,
        },
      },
      async (e) => {
        if (e.type === 'rep') {
          const engine = engineRef.current;
          if (!engine) return;
          const evs = engine.processRep(e.rep);
          await handleRepEvents(evs);
          const classification = classifyEvents(evs);
          setReps((cur) => [...cur, { ...e.rep, classification }]);
          const stopEv = evs.find((x) => x.type === 'STOP_SET');
          if (stopEv && stopEv.type === 'STOP_SET') {
            await finishSet(stopEv.reason);
          }
        } else if (e.type === 'tracking_lost') {
          setTrackingState('lost');
        } else if (e.type === 'tracking_restored') {
          setTrackingState('tracking');
        } else if (e.type === 'debug') {
          setTrackingState(e.frame.state);
        } else if (e.type === 'ended' && e.reason === 'no_motion') {
          await finishSet('complete');
        }
      },
    );
    handleRef.current = handle;
  }

  function handlePreviewTap(e: PointerEvent<HTMLVideoElement>) {
    if (!useRealCvExperimental || status !== 'idle') return;
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;
    const rect = video.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * video.videoWidth;
    const y = ((e.clientY - rect.top) / rect.height) * video.videoHeight;
    setMarkerPoint({ x, y });
    setTrackingState('acquiring');
    setStreamErr('Marker selected. Start the set when the bar is still.');
  }

  async function stopByUser() {
    await finishSet('user');
  }

  async function finishSet(reason: SetStopReason) {
    if (status === 'stopped') return;
    setStatus('stopped');
    setStopReason(reason);
    await handleRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;

    const engine = engineRef.current;
    if (!engine || !activeSessionId) return;
    const snapshot = engine.getSnapshot();
    const set: SetRecord = {
      id: uid(),
      sessionId: activeSessionId,
      liftId: activeSet!.liftId,
      loadKg: activeSet!.loadKg,
      target: activeSet!.target,
      reps: snapshot.reps,
      bestMeanVelocityMps: snapshot.bestMeanVelocityMps,
      stopReason: reason,
      createdAt: Date.now(),
    };
    try {
      await repo.appendSet(activeSessionId, set);
    } catch {
      /* ignore for now */
    }
    const profile = (await repo.getProfile(activeSet!.liftId)) ?? {
      liftId: activeSet!.liftId,
      points: [],
    };
    const rec = computePostSetRecommendation(set, profile);
    setLastCompletedSet(set, rec);
    navigate('/post-set');
  }

  return (
    <>
      <header className="topbar">
        <Link to="/new" className="crumb">← Cancel</Link>
        <h1>{lift.shortName} · {activeSet.loadKg} kg</h1>
        <span
          className={`status-pill ${status === 'live' ? 'live' : status === 'stopped' ? 'stopped' : ''}`}
        >
          {status === 'idle' ? 'ready' : status}
        </span>
      </header>

      <section className="card stack">
        <div className="video-frame">
          <video ref={videoRef} playsInline muted autoPlay onPointerDown={handlePreviewTap} />
          {markerPoint && useRealCvExperimental && videoRef.current && (
            <span
              className="marker-reticle"
              style={{
                left: `${(markerPoint.x / Math.max(1, videoRef.current.videoWidth)) * 100}%`,
                top: `${(markerPoint.y / Math.max(1, videoRef.current.videoHeight)) * 100}%`,
              }}
            />
          )}
          <div className="video-overlay">
            <span className="status-pill">
              {activeSet.target.kind === 'range'
                ? `${activeSet.target.minMps}–${activeSet.target.maxMps} m/s`
                : `drop ${Math.round(activeSet.target.thresholdPct * 100)}%`}
            </span>
            <span className="status-pill">{audioMode.replace('_', ' ')}</span>
          </div>
        </div>
        {streamErr && <div className="muted-note">{streamErr}</div>}
        {useRealCvExperimental && (
          <div className="muted-note">
            Real CV: {trackingState.replace('_', ' ')} - {markerDiameterMm} mm {markerProfile.replace('_', ' ')}
          </div>
        )}
      </section>

      <section className="card stack">
        <div className="section-title">
          <h2>Reps</h2>
          <span className="muted-note">{reps.length} so far</span>
        </div>
        <div className="big-counter">{reps.length}</div>
        <div className="rep-list">
          {reps.map((r) => (
            <div key={r.index} className={`rep-line ${r.classification}`}>
              <span>Rep {r.index}</span>
              <span>{r.meanVelocityMps.toFixed(2)} m/s</span>
              <span className="muted-note">conf {(r.confidence * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </section>

      {status === 'idle' && (
        <button className="btn primary block" onClick={startRecording}>
          {!useRealCvExperimental
            ? 'Start simulated set'
            : !streamRef.current
            ? 'Open camera'
            : streamRef.current && !markerPoint
              ? 'Start after tapping marker'
              : 'Start recording'}
        </button>
      )}
      {status === 'live' && (
        <button className="btn danger block" onClick={stopByUser}>
          End set
        </button>
      )}
      {status === 'stopped' && (
        <Link to="/post-set" className="btn primary block">
          Review set ({stopReason})
        </Link>
      )}
    </>
  );
}
