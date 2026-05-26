import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../state/appStore';
import { LIFTS } from '../../domain/lifts';

export function PostSet() {
  const navigate = useNavigate();
  const set = useAppStore((s) => s.lastCompletedSet);
  const rec = useAppStore((s) => s.lastRecommendation);
  const setActiveSet = useAppStore((s) => s.setActiveSet);

  if (!set || !rec) {
    return (
      <>
        <header className="topbar">
          <Link to="/" className="crumb">← Home</Link>
          <h1>No set</h1>
          <span className="crumb" />
        </header>
        <div className="muted-note">Run a set first.</div>
      </>
    );
  }

  const lift = LIFTS[set.liftId];

  function repeatOrAdjust(loadKg: number) {
    setActiveSet({
      liftId: set!.liftId,
      loadKg,
      target: set!.target,
      plannedReps:
        set!.target.kind === 'dropoff' ? set!.target.plannedReps : undefined,
    });
    navigate('/record');
  }

  const actionLabel: Record<typeof rec.action, string> = {
    add_weight: '+ Add weight',
    repeat_weight: '↻ Repeat weight',
    reduce_weight: '− Reduce weight',
    stop_exercise: '✕ Stop exercise',
  };

  return (
    <>
      <header className="topbar">
        <Link to="/" className="crumb">← Home</Link>
        <h1>Post-set</h1>
        <span className="crumb" />
      </header>

      <section className="card stack">
        <h2>{lift.name} · {set.loadKg} kg</h2>
        <div className="tile-grid">
          <div className="tile">
            <span className="label">Reps</span>
            <span className="value">{set.reps.length}</span>
          </div>
          <div className="tile">
            <span className="label">Best mean velocity</span>
            <span className="value">{set.bestMeanVelocityMps.toFixed(2)} m/s</span>
          </div>
          <div className="tile">
            <span className="label">Stop reason</span>
            <span className="value">{set.stopReason}</span>
          </div>
          <div className="tile">
            <span className="label">Target</span>
            <span className="value">
              {set.target.kind === 'range'
                ? `${set.target.minMps}–${set.target.maxMps} m/s`
                : `${Math.round(set.target.thresholdPct * 100)}% drop`}
            </span>
          </div>
        </div>
      </section>

      <section className="card stack">
        <h2>Recommendation</h2>
        <div className="tile active">
          <span className="label">next set</span>
          <span className="value">{actionLabel[rec.action]}</span>
          <span className="muted-note">{rec.reason}</span>
        </div>
        <div className="row">
          {rec.action !== 'stop_exercise' && (
            <button
              className="btn primary"
              style={{ flex: 1 }}
              onClick={() => repeatOrAdjust(rec.suggestedLoadKg ?? set.loadKg)}
            >
              Use {rec.suggestedLoadKg ?? set.loadKg} kg
            </button>
          )}
          <Link to="/new" className="btn" style={{ flex: 1 }}>
            Different lift
          </Link>
        </div>
      </section>
    </>
  );
}
