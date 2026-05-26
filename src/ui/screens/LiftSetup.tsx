import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LIFTS } from '../../domain/lifts';
import type { LiftId, VelocityTarget } from '../../domain/types';
import { useAppStore } from '../../state/appStore';

type Mode = 'range' | 'dropoff';

export function LiftSetup() {
  const { liftId } = useParams<{ liftId: LiftId }>();
  const navigate = useNavigate();
  const setActiveSet = useAppStore((s) => s.setActiveSet);

  if (!liftId || !LIFTS[liftId]) {
    return (
      <>
        <header className="topbar">
          <Link to="/new" className="crumb">← Back</Link>
          <h1>Unknown lift</h1>
          <span className="crumb" />
        </header>
      </>
    );
  }
  const lift = LIFTS[liftId];

  const [mode, setMode] = useState<Mode>('range');
  const [loadKg, setLoadKg] = useState<number>(100);
  const [minMps, setMinMps] = useState(lift.defaultRange.minMps);
  const [maxMps, setMaxMps] = useState(lift.defaultRange.maxMps);
  const [dropoffPct, setDropoffPct] = useState(20);
  const [plannedReps, setPlannedReps] = useState(5);

  function startSet() {
    const target: VelocityTarget =
      mode === 'range'
        ? { kind: 'range', minMps, maxMps }
        : {
            kind: 'dropoff',
            thresholdPct: dropoffPct / 100,
            plannedReps,
          };
    setActiveSet({ liftId: lift.id, loadKg, target, plannedReps });
    navigate('/record');
  }

  return (
    <>
      <header className="topbar">
        <Link to="/new" className="crumb">← Back</Link>
        <h1>{lift.name}</h1>
        <span className="crumb" />
      </header>

      <section className="card stack">
        <h2>Target mode</h2>
        <div className="row">
          <button
            className={`btn ${mode === 'range' ? 'primary' : ''}`}
            onClick={() => setMode('range')}
          >
            Velocity range
          </button>
          <button
            className={`btn ${mode === 'dropoff' ? 'primary' : ''}`}
            onClick={() => setMode('dropoff')}
          >
            Drop-off
          </button>
        </div>

        {mode === 'range' ? (
          <div className="row">
            <label style={{ flex: 1 }}>
              Min (m/s)
              <input
                type="number"
                step="0.05"
                value={minMps}
                onChange={(e) => setMinMps(parseFloat(e.target.value))}
              />
            </label>
            <label style={{ flex: 1 }}>
              Max (m/s)
              <input
                type="number"
                step="0.05"
                value={maxMps}
                onChange={(e) => setMaxMps(parseFloat(e.target.value))}
              />
            </label>
          </div>
        ) : (
          <div className="row">
            <label style={{ flex: 1 }}>
              Drop-off %
              <select
                value={dropoffPct}
                onChange={(e) => setDropoffPct(parseInt(e.target.value, 10))}
              >
                <option value={10}>10%</option>
                <option value={15}>15%</option>
                <option value={20}>20%</option>
                <option value={25}>25%</option>
                <option value={30}>30%</option>
              </select>
            </label>
            <label style={{ flex: 1 }}>
              Planned reps
              <input
                type="number"
                min={1}
                max={20}
                value={plannedReps}
                onChange={(e) => setPlannedReps(parseInt(e.target.value, 10))}
              />
            </label>
          </div>
        )}
      </section>

      <section className="card stack">
        <h2>Working weight</h2>
        <label>
          Load (kg)
          <input
            type="number"
            step="2.5"
            value={loadKg}
            onChange={(e) => setLoadKg(parseFloat(e.target.value))}
          />
        </label>
      </section>

      <button className="btn primary block" onClick={startSet}>
        Start set
      </button>
    </>
  );
}
