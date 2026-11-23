import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { OnboardingRoute } from './routes/OnboardingRoute'
import { AppLayout } from './layouts/AppLayout'
import { CustomCursor } from './components/CustomCursor'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import MembersPage from './pages/MembersPage'
import PaymentsPage from './pages/PaymentsPage'
import RemindersPage from './pages/RemindersPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import MemberDetailPage from './pages/MemberDetailPage'

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <CustomCursor />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          <Route element={<OnboardingRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="members/:memberId" element={<MemberDetailPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="reminders" element={<RemindersPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App