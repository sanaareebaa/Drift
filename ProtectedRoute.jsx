import { Navigate } from 'react-router-dom'
import AppShell from './AppShell'
import ReminderBanner from './ReminderBanner'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <main className="page"><p>Loading…</p></main>
  if (!user) return <Navigate to="/login" replace />
  return (
    <AppShell>
      <ReminderBanner />
      {children}
    </AppShell>
  )
}