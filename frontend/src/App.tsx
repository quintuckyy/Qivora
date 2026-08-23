import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsListPage } from './pages/ApplicationsListPage';
import { ApplicationCreatePage } from './pages/ApplicationCreatePage';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { ResumesPage } from './pages/ResumesPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { EmailSyncPage } from './pages/EmailSyncPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/applications" element={<ApplicationsListPage />} />
              <Route path="/applications/new" element={<ApplicationCreatePage />} />
              <Route path="/applications/:id" element={<ApplicationDetailPage />} />
              <Route path="/resumes" element={<ResumesPage />} />
              <Route path="/statistics" element={<StatisticsPage />} />
              <Route path="/email-sync" element={<EmailSyncPage />} />
            </Route>
          </Route>

          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
