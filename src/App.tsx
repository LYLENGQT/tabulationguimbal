import { Navigate, Route, Routes } from 'react-router-dom';
import { JudgeLoginPage } from './pages/JudgeLoginPage';
import { JudgeScoringPage } from './pages/JudgeScoringPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { RankingsPage } from './pages/RankingsPage';
import { ProtectedRoute } from './components/ProtectedRoute';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<JudgeLoginPage />} />
        <Route
          path="/judge"
          element={
            <ProtectedRoute>
              <JudgeScoringPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rankings"
          element={
            <ProtectedRoute>
              <RankingsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}
