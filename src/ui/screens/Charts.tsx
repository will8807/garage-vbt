import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  CartesianGrid,
} from 'recharts';
import { useSessionRepo } from '../../state/useSessionRepo';
import type { Session, VelocityProfile, LiftId } from '../../domain/types';
import { ALL_LIFTS, LIFTS } from '../../domain/lifts';

interface ProfileWithEstimate extends VelocityProfile {
  estimatedTrainingMaxKg?: number;
}

function estimateTrainingMax(profile: VelocityProfile): number | undefined {
  if (profile.points.length < 2) return profile.estimatedTrainingMaxKg;
  const sorted = [...profile.points].sort((a, b) => a.loadKg - b.loadKg);
  const x = sorted.map((p) => p.loadKg);
  const y = sorted.map((p) => p.meanVelocityMps);
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (x[i] - mx) * (y[i] - my);
    den += (x[i] - mx) ** 2;
  }
  if (den === 0) return undefined;
  const m = num / den;
  const b = my - m * mx;
  // training-max ~ load where mean velocity ≈ 0.15 m/s
  const tm = (0.15 - b) / m;
  if (!isFinite(tm) || tm <= 0) return undefined;
  return Math.round(tm / 2.5) * 2.5;
}

export function Charts() {
  const repo = useSessionRepo();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [profiles, setProfiles] = useState<Record<LiftId, ProfileWithEstimate>>(
    {} as Record<LiftId, ProfileWithEstimate>,
  );
  const [selectedLift, setSelectedLift] = useState<LiftId>('squat');

  useEffect(() => {
    repo.listSessions().then(setSessions).catch(() => setSessions([]));
    Promise.all(
      ALL_LIFTS.map((l) =>
        repo.getProfile(l.id).then((p) => [l.id, p ?? { liftId: l.id, points: [] }] as const),
      ),
    ).then((entries) => {
      const next: Record<LiftId, ProfileWithEstimate> = {} as Record<
        LiftId,
        ProfileWithEstimate
      >;
      for (const [id, profile] of entries) {
        next[id] = { ...profile, estimatedTrainingMaxKg: estimateTrainingMax(profile) };
      }
      setProfiles(next);
    });
  }, [repo]);

  const tmData = useMemo(
    () =>
      ALL_LIFTS.map((l) => ({
        lift: l.shortName,
        kg: profiles[l.id]?.estimatedTrainingMaxKg ?? 0,
      })),
    [profiles],
  );

  const profileForLift = profiles[selectedLift];
  const lvData = useMemo(() => {
    if (!profileForLift) return [];
    return [...profileForLift.points]
      .sort((a, b) => a.loadKg - b.loadKg)
      .map((p) => ({ loadKg: p.loadKg, meanVelocityMps: p.meanVelocityMps }));
  }, [profileForLift]);

  const volumeData = useMemo(
    () =>
      sessions
        .slice()
        .reverse()
        .map((s) => ({
          date: new Date(s.startedAt).toLocaleDateString(),
          tonnage: s.sets.reduce(
            (sum, set) => sum + set.loadKg * set.reps.length,
            0,
          ),
        })),
    [sessions],
  );

  const setTrend = useMemo(() => {
    const latest = sessions.find((s) =>
      s.sets.some((x) => x.liftId === selectedLift),
    );
    if (!latest) return [];
    const set = latest.sets.find((x) => x.liftId === selectedLift);
    if (!set) return [];
    return set.reps.map((r) => ({ rep: r.index, mps: r.meanVelocityMps }));
  }, [sessions, selectedLift]);

  return (
    <>
      <header className="topbar">
        <Link to="/" className="crumb">← Home</Link>
        <h1>Charts</h1>
        <span className="crumb" />
      </header>

      <section className="card stack">
        <div className="section-title">
          <h2>Lift</h2>
        </div>
        <div className="row">
          {ALL_LIFTS.map((l) => (
            <button
              key={l.id}
              className={`btn ${selectedLift === l.id ? 'primary' : ''}`}
              onClick={() => setSelectedLift(l.id)}
            >
              {l.shortName}
            </button>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2>Estimated training max</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <BarChart data={tmData}>
              <CartesianGrid stroke="#2a313d" />
              <XAxis dataKey="lift" stroke="#9aa3b2" />
              <YAxis stroke="#9aa3b2" />
              <Tooltip
                contentStyle={{ background: '#181c24', border: '1px solid #2a313d' }}
              />
              <Bar dataKey="kg" fill="#4ade80" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card stack">
        <h2>Best velocity vs. load — {LIFTS[selectedLift].shortName}</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <ScatterChart>
              <CartesianGrid stroke="#2a313d" />
              <XAxis dataKey="loadKg" name="load" unit="kg" stroke="#9aa3b2" />
              <YAxis dataKey="meanVelocityMps" name="m/s" stroke="#9aa3b2" />
              <Tooltip
                contentStyle={{ background: '#181c24', border: '1px solid #2a313d' }}
              />
              <Scatter data={lvData} fill="#4ade80" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card stack">
        <h2>Session volume (tonnage)</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <BarChart data={volumeData}>
              <CartesianGrid stroke="#2a313d" />
              <XAxis dataKey="date" stroke="#9aa3b2" />
              <YAxis stroke="#9aa3b2" />
              <Tooltip
                contentStyle={{ background: '#181c24', border: '1px solid #2a313d' }}
              />
              <Bar dataKey="tonnage" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card stack">
        <h2>Per-set velocity trend — {LIFTS[selectedLift].shortName}</h2>
        <div className="chart-wrap">
          <ResponsiveContainer>
            <LineChart data={setTrend}>
              <CartesianGrid stroke="#2a313d" />
              <XAxis dataKey="rep" stroke="#9aa3b2" />
              <YAxis stroke="#9aa3b2" />
              <Tooltip
                contentStyle={{ background: '#181c24', border: '1px solid #2a313d' }}
              />
              <Line
                type="monotone"
                dataKey="mps"
                stroke="#4ade80"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}
