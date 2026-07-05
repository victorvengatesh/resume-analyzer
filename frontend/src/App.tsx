import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Candidates from './pages/Candidates';
import CandidateDetail from './pages/CandidateDetail';
import Compare from './pages/Compare';
import Analytics from './pages/Analytics';
import UploadPage from './pages/UploadPage';
import BulkAnalyzer from './pages/BulkAnalyzer';
import InterviewCopilot from './pages/InterviewCopilot';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import { ToastProvider } from './components/ui/Toast';
import { isAuthenticated } from './api';

// Route Guard component
function ProtectedRoutes() {
  if (!isAuthenticated()) {
    return <Navigate to="/landing" replace />;
  }
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/landing" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />

          {/* Protected Recruiter Cockpit Routes */}
          <Route element={<ProtectedRoutes />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/candidates/:id" element={<CandidateDetail />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/bulk" element={<BulkAnalyzer />} />
            <Route path="/interview" element={<InterviewCopilot />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
