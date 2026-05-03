import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import AdminDashboard from '@/pages/admin/Dashboard'
import EngineerDashboard from '@/pages/engineer/Dashboard'
import { PageSpinner } from '@/components/ui/Spinner'

export default function DashboardRouter() {
  const { profile, loading } = useAuth()

  // Still initialising auth
  if (loading) return <PageSpinner />

  // Profile loaded and is admin
  if (profile?.role === 'admin') return <AdminDashboard />

  // Profile loaded and is engineer (or other role)
  if (profile?.role === 'engineer') return <EngineerDashboard />

  // Profile is null after loading — ghost session was cleared, show nothing
  // (ProtectedRoute will have already redirected to /login)
  return <PageSpinner />
}
