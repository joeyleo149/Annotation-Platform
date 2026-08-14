import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router';

import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VideoAnnotatorPage from './pages/VideoAnnotatorPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/register"
          element={<RegisterPage />}
        />

        <Route
          path="/Admin-Dashboard"
          element={<AdminDashboard />}
        />

        <Route
          path="/annotate/:sessionId"
          element={<VideoAnnotatorPage />}
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}