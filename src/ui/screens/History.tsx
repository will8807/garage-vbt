import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSessionRepo } from '../../state/useSessionRepo';
import type { Session } from '../../domain/types';
import { LIFTS } from '../../domain/lifts';

export function History() {
  const repo = useSessionRepo();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    repo.listSessions().then(setSessions).catch(() => setSessions([]));
  }, [repo]);

  return (
    <>
      <header className="topbar">
        <Link to="/" className="crumb">← Home</Link>
        <h1>History</h1>
        <span className="crumb" />
      </header>

      {sessions.length === 0 && (
        <div className="card muted-note">No sessions yet. Start one from Home.</div>
      )}

      {sessions.map((s) => (
        <section key={s.id} className="card stack">
          <div className="section-title">
            <h2>{new Date(s.startedAt).toLocaleString()}</h2>
            <span className="muted-note">{s.sets.length} sets</span>
          </div>
          {s.sets.length === 0 ? (
            <div className="muted-note">No sets recorded.</div>
          ) : (
            s.sets.map((set) => (
              <div key={set.id} className="tile" style={{ minHeight: 'unset' }}>
                <span className="label">{LIFTS[set.liftId].shortName}</span>
                <span className="value">
                  {set.loadKg} kg · {set.reps.length} reps · best{' '}
                  {set.bestMeanVelocityMps.toFixed(2)} m/s
                </span>
                <span className="muted-note">stop: {set.stopReason}</span>
              </div>
            ))
          )}
        </section>
      ))}
    </>
  );
}
