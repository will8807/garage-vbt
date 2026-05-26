import { NavLink, Route, Routes } from 'react-router-dom';
import { Home } from './ui/screens/Home';
import { NewSession } from './ui/screens/NewSession';
import { LiftSetup } from './ui/screens/LiftSetup';
import { RecordSet } from './ui/screens/RecordSet';
import { PostSet } from './ui/screens/PostSet';
import { History } from './ui/screens/History';
import { Charts } from './ui/screens/Charts';
import { Settings } from './ui/screens/Settings';

export function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<NewSession />} />
        <Route path="/setup/:liftId" element={<LiftSetup />} />
        <Route path="/record" element={<RecordSet />} />
        <Route path="/post-set" element={<PostSet />} />
        <Route path="/history" element={<History />} />
        <Route path="/charts" element={<Charts />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>

      <nav className="tabbar">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/charts">Charts</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
    </div>
  );
}
