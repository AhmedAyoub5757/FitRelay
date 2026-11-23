import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AppPreloader } from '../components/AppPreloader'

export function ProtectedRoute() {
  const { session, appUser, isLoading } = useAuth()

  if (isLoading) return <AppPreloader isLoading={true} />
  if (!session) return <Navigate to="/login" replace />
  if (!appUser) return <Navigate to="/onboarding" replace />

  return <Outlet />
}
