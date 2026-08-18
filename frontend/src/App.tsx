import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router';

import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VideoAnnotatorPage from './pages/VideoAnnotatorPage';
import { AnnotatorDashboard } from './pages/AnnotatorDashboard';
import { AnnotatorSurveyPage } from './pages/AnnotatorSurveyPage';
import VerticalNav from './components/VerticalNav';
import SurveyReminderCard from './components/SurveyReminderCard';

import ProfilePage from './pages/ProfilePage';

import {
  getCurrentUser,
  homeFor,
} from './services/authService';

/*
 * AdminDashboard already contains its own complete sidebar.
 * This route protection must not render VerticalNav.
 */
function AdminProtectedRoute() {
  const user = getCurrentUser();

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (user.role !== 'Admin') {
    return (
      <Navigate
        to={homeFor(user.role)}
        replace
      />
    );
  }

  return <Outlet />;
}

/*
 * Annotators continue using their existing VerticalNav.
 */
function AnnotatorProtectedRoute() {
  const user = getCurrentUser();

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (user.role !== 'Annotator') {
    return (
      <Navigate
        to={homeFor(user.role)}
        replace
      />
    );
  }

  return (
    <div className="app-shell">
      <VerticalNav role="Annotator" />

      <main className="dashboard-content">
        <Outlet />
      </main>

      {/* Survey reminder pop-up for annotators */}
      <SurveyReminderCard />
    </div>
  );
}



function RootRedirect() {
  const user = getCurrentUser();

  return (
    <Navigate
      to={
        user
          ? homeFor(user.role)
          : '/login'
      }
      replace
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<RootRedirect />}
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/register"
          element={<RegisterPage />}
        />

        {/* Admin routes: no external sidebar */}
        <Route element={<AdminProtectedRoute />}>
          <Route
            path="/admin"
            element={
              <Navigate
                to="/admin/upload"
                replace
              />
            }
          />

          <Route path="/admin/profile" element={<AdminDashboard />} />

          <Route
            path="/admin/upload"
            element={<AdminDashboard />}
          />
        </Route>

        {/* Annotator routes: existing sidebar preserved */}
        <Route element={<AnnotatorProtectedRoute />}>
          <Route
            path="/survey"
            element={<AnnotatorSurveyPage />}
          />

          <Route
            path="/workspace"
            element={<AnnotatorDashboard />}
          />

          <Route
            path="/annotator/videos"
            element={<AnnotatorDashboard />}
          />

          <Route
            path="/annotator/annotations"
            element={<AnnotatorDashboard />}
          />

          <Route path="/annotator/profile" element={<ProfilePage />} />

          <Route
            path="/annotate/:sessionId"
            element={<VideoAnnotatorPage />}
          />
        </Route>

        <Route
          path="*"
          element={<RootRedirect />}
        />
      </Routes>
    </BrowserRouter>
  );
}