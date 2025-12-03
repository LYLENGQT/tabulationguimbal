import { Navigate, Route, Routes } from 'react-router-dom';
import { JudgeLoginPage } from './pages/JudgeLoginPage';
import { JudgeScoringPage } from './pages/JudgeScoringPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { RankingsPage } from './pages/RankingsPage';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<JudgeLoginPage />} />
        <Route path="/judge" element={<JudgeScoringPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/rankings" element={<RankingsPage />} />
      </Routes>
    </div>
  );
}


