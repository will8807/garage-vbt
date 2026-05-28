import { Link } from 'react-router-dom';
import { useAppStore } from '../../state/appStore';
import { useSessionRepo } from '../../state/useSessionRepo';
import { tones, unlockAudio } from '../../audio/tones';
import { sayNumber } from '../../audio/speech';
import type { AudioFeedbackMode } from '../../domain/types';
import type { MarkerProfileId } from '../../cv/markerTypes';

const MODES: { id: AudioFeedbackMode; label: string; note: string }[] = [
  { id: 'count_and_tone', label: 'Count + tone', note: 'spoken number then a positive/negative tone' },
  { id: 'tone_only', label: 'Tone only', note: 'just the pass/fail tone, no number' },
  { id: 'count_only', label: 'Count only', note: 'spoken number, no tone' },
  { id: 'muted', label: 'Muted', note: 'silent - visual only' },
];

const MARKER_PROFILES: { id: MarkerProfileId; label: string; note: string }[] = [
  { id: 'neon_green', label: 'Neon green', note: 'best default for high-vis stickers' },
  { id: 'neon_orange', label: 'Neon orange', note: 'use when green blends into the room' },
  { id: 'reflective', label: 'Reflective', note: 'bright marker with strong direct light' },
];

export function Settings() {
  const audioMode = useAppStore((s) => s.audioMode);
  const setAudioMode = useAppStore((s) => s.setAudioMode);
  const useRealCvExperimental = useAppStore((s) => s.useRealCvExperimental);
  const setUseRealCvExperimental = useAppStore((s) => s.setUseRealCvExperimental);
  const markerDiameterMm = useAppStore((s) => s.markerDiameterMm);
  const setMarkerDiameterMm = useAppStore((s) => s.setMarkerDiameterMm);
  const markerProfile = useAppStore((s) => s.markerProfile);
  const setMarkerProfile = useAppStore((s) => s.setMarkerProfile);
  const repo = useSessionRepo();

  async function previewMode(mode: AudioFeedbackMode) {
    await unlockAudio();
    setAudioMode(mode);
    if (mode === 'muted') return;
    if (mode !== 'tone_only') await sayNumber(3);
    if (mode !== 'count_only') await tones.positive();
  }

  async function clearAll() {
    if (!confirm('Erase all sessions and velocity history?')) return;
    await repo.clear();
    alert('History cleared.');
  }

  return (
    <>
      <header className="topbar">
        <Link to="/" className="crumb">← Home</Link>
        <h1>Settings</h1>
        <span className="crumb" />
      </header>

      <section className="card stack">
        <h2>Audio feedback</h2>
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`tile ${audioMode === m.id ? 'active' : ''}`}
            onClick={() => previewMode(m.id)}
          >
            <span className="label">{audioMode === m.id ? 'active' : 'tap to use'}</span>
            <span className="value">{m.label}</span>
            <span className="muted-note">{m.note}</span>
          </button>
        ))}
      </section>

      <section className="card stack">
        <h2>Real CV</h2>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={useRealCvExperimental}
            onChange={(e) => setUseRealCvExperimental(e.target.checked)}
          />
          <span>
            <strong>Use real CV</strong>
            <span className="muted-note">Experimental marker tracking</span>
          </span>
        </label>
        <label>
          Marker diameter (mm)
          <input
            type="number"
            min={10}
            max={80}
            step={1}
            value={markerDiameterMm}
            onChange={(e) => setMarkerDiameterMm(Number(e.target.value))}
          />
        </label>
        <label>
          Marker profile
          <select
            value={markerProfile}
            onChange={(e) => setMarkerProfile(e.target.value as MarkerProfileId)}
          >
            {MARKER_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <span className="muted-note">
          Place the marker on the sleeve end or collar face, then tap it in the set preview.
        </span>
      </section>

      <section className="card stack">
        <h2>Data</h2>
        <button className="btn danger" onClick={clearAll}>
          Clear local history
        </button>
        <span className="muted-note">
          History is stored on this device only. There is no cloud sync.
        </span>
      </section>
    </>
  );
}
