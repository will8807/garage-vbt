import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ALL_LIFTS } from '../../domain/lifts';
import { useAppStore } from '../../state/appStore';
import { useSessionRepo } from '../../state/useSessionRepo';

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function NewSession() {
  const navigate = useNavigate();
  const repo = useSessionRepo();
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId);
  const activeSessionId = useAppStore((s) => s.activeSessionId);

  useEffect(() => {
    if (!activeSessionId) {
      const id = uid();
      repo
        .saveSession({ id, startedAt: Date.now(), sets: [] })
        .then(() => setActiveSessionId(id))
        .catch(() => {/* ignore */});
    }
  }, [activeSessionId, repo, setActiveSessionId]);

  return (
    <>
      <header className="topbar">
        <Link to="/" className="crumb">← Home</Link>
        <h1>New session</h1>
        <span className="crumb" />
      </header>

      <section className="card stack">
        <h2>Pick a lift</h2>
        <div className="tile-grid">
          {ALL_LIFTS.map((lift) => (
            <button
              key={lift.id}
              className="tile"
              onClick={() => navigate(`/setup/${lift.id}`)}
            >
              <span className="label">{lift.id}</span>
              <span className="value">{lift.name}</span>
              <span className="muted-note">
                target {lift.defaultRange.minMps}–{lift.defaultRange.maxMps} m/s
              </span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
