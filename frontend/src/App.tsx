import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VideoAnnotatorPage from './pages/VideoAnnotatorPage';
import VerticalNav from './components/VerticalNav';
import { getCurrentUser, homeFor, type Role } from './services/authService';

function ProtectedRoute({ role }: { role: Role }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return <div className="app-shell"><VerticalNav role={user.role} /><main className="dashboard-content"><Outlet /></main></div>;
}

function DashboardView({ title, description }: { title: string; description: string }) {
  return <section className="dashboard-view"><p className="dashboard-kicker">Annotate Pro</p><h1>{title}</h1><p>{description}</p></section>;
}

function RootRedirect() { const user = getCurrentUser(); return <Navigate to={user ? homeFor(user.role) : '/login'} replace />; }

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<RootRedirect />} /><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} />
    <Route element={<ProtectedRoute role="Admin" />}>
      <Route path="/admin/upload" element={<DashboardView title="Upload Video" description="Upload and prepare a new video for annotation." />} />
      <Route path="/admin/videos" element={<DashboardView title="Uploaded Videos" description="Review videos available to annotators." />} />
      <Route path="/admin/profile" element={<DashboardView title="Profile" description="Manage your administrator account." />} />
      <Route path="/admin/add-admin" element={<DashboardView title="Add Admin" description="Create another administrator account." />} />
    </Route>
    <Route element={<ProtectedRoute role="Annotator" />}>
      <Route path="/annotator/videos" element={<DashboardView title="Get a Video" description="Choose your next available annotation task." />} />
      <Route path="/annotator/annotations" element={<DashboardView title="My Annotations" description="Continue or review your annotation work." />} />
      <Route path="/annotator/profile" element={<DashboardView title="Profile" description="Manage your annotator account." />} />
      <Route path="/annotate/:sessionId" element={<VideoAnnotatorPage />} />
    </Route>
    <Route path="*" element={<RootRedirect />} />
  </Routes></BrowserRouter>;
}
