import { Navigate, Route, Routes } from 'react-router-dom';
import { JudgeLoginPage } from './pages/JudgeLoginPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { JudgeScoringPage } from './pages/JudgeScoringPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { RankingsPage } from './pages/RankingsPage';
import { ContestantInsightsPage } from './pages/ContestantInsightsPage';
import { LiveDisplayPage } from './pages/LiveDisplayPage';
import { ProtectedRoute } from './components/ProtectedRoute';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<JudgeLoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
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
        <Route
          path="/insights"
          element={
            <ProtectedRoute>
              <ContestantInsightsPage />
            </ProtectedRoute>
          }
        />
        {/* Live Display - Public route for projector/audience display */}
        <Route path="/live" element={<LiveDisplayPage />} />
      </Routes>
    </div>
  );
}
