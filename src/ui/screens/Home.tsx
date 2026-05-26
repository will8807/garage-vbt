import { Link } from 'react-router-dom';
import { FULL_BODY_3_DAY } from '../../templates';

export function Home() {
  return (
    <>
      <header className="topbar">
        <h1>Garage VBT</h1>
        <span className="crumb">solo lifter</span>
      </header>

      <section className="card stack">
        <div className="section-title">
          <h2>Today</h2>
        </div>
        <Link to="/new" className="btn primary block">Start a session</Link>
        <Link to="/charts" className="btn block">View progress</Link>
      </section>

      <section className="card stack">
        <div className="section-title">
          <h2>{FULL_BODY_3_DAY.name}</h2>
        </div>
        {FULL_BODY_3_DAY.days.map((d) => (
          <div key={d.id} className="tile" style={{ minHeight: 'unset' }}>
            <span className="label">{d.id}</span>
            <span className="value">{d.name}</span>
            <span className="muted-note">
              {d.blocks.map((b) => b.label).join(' · ')}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
