import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useQuery } from '@tanstack/react-query'
import supabase from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { profile } = useAuth()

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pending-assignments-count'],
    queryFn: async () => {
      if (profile?.role !== 'admin') return 0
      const { count } = await supabase
        .from('service_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      return count ?? 0
    },
    enabled: profile?.role === 'admin',
    refetchInterval: 60000,
  })

  const { data: notifCount = 0 } = useQuery({
    queryKey: ['unread-notifications-count', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return 0
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', profile.id)
        .eq('is_read', false)
      return count ?? 0
    },
    enabled: !!profile?.id,
    refetchInterval: 30000,
  })

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(c => !c)}
          pendingCount={pendingCount}
          notifCount={notifCount}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full z-10">
            <Sidebar
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              pendingCount={pendingCount}
              notifCount={notifCount}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          onMenuToggle={() => setMobileOpen(o => !o)}
          notifCount={notifCount}
        />
        <main className="flex-1 overflow-y-auto bg-slate-950 p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
