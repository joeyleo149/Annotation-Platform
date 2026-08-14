import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VideoAnnotatorPage from './pages/VideoAnnotatorPage';
import AddAdminPage from './pages/AddAdminPage';
import { AnnotatorDashboard } from './pages/AnnotatorDashboard';
import { AnnotatorSurveyPage } from './pages/AnnotatorSurveyPage';
import VerticalNav from './components/VerticalNav';
import { getSurveyStatus } from './services/SurveyService';
import { getCurrentUser, homeFor, type Role } from './services/authService';

function ProtectedRoute({ role }: { role: Role }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return <div className="app-shell"><VerticalNav role={user.role} /><main className="dashboard-content"><Outlet /></main></div>;
}

function SurveyGate() {
  const location = useLocation();
  const [completed, setCompleted] = useState<boolean | null>(null);
  useEffect(() => { getSurveyStatus().then(result => setCompleted(result.hasCompletedSurvey)).catch(() => setCompleted(false)); }, [location.key]);
  if (completed === null) return <p className="p-8">Checking survey status...</p>;
  return completed ? <Outlet /> : <Navigate to="/survey" replace state={{ from: location.pathname }} />;
}

function Placeholder({ title, description }: { title: string; description: string }) {
  return <section className="dashboard-view"><p className="dashboard-kicker">Annotate Pro</p><h1>{title}</h1><p>{description}</p></section>;
}

function RootRedirect() { const user = getCurrentUser(); return <Navigate to={user ? homeFor(user.role) : '/login'} replace />; }

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<RootRedirect />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route element={<ProtectedRoute role="Admin" />}>
      <Route path="/admin/upload" element={<AdminDashboard />} />
      <Route path="/admin/videos" element={<Placeholder title="Uploaded Videos" description="Review videos available to annotators." />} />
      <Route path="/admin/profile" element={<Placeholder title="Profile" description="Manage your administrator account." />} />
      <Route path="/admin/add-admin" element={<AddAdminPage />} />
    </Route>
    <Route element={<ProtectedRoute role="Annotator" />}>
      <Route path="/survey" element={<AnnotatorSurveyPage />} />
      <Route element={<SurveyGate />}>
        <Route path="/workspace" element={<AnnotatorDashboard />} />
        <Route path="/annotator/videos" element={<AnnotatorDashboard />} />
        <Route path="/annotator/annotations" element={<AnnotatorDashboard />} />
        <Route path="/annotator/profile" element={<Placeholder title="Profile" description="Manage your annotator account." />} />
        <Route path="/annotate/:sessionId" element={<VideoAnnotatorPage />} />
      </Route>
    </Route>
    <Route path="*" element={<RootRedirect />} />
  </Routes></BrowserRouter>;
}
