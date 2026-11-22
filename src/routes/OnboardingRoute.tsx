import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function OnboardingRoute() {
  const { session, appUser, isLoading } = useAuth()

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading...</div>
  if (!session) return <Navigate to="/login" replace />
  if (appUser) return <Navigate to="/app" replace />

  return <Outlet />
}