import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, Search, Menu } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface HeaderProps {
  onMenuToggle?: () => void
  notifCount?: number
}

const BREADCRUMBS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/equipment': 'Equipment',
  '/assignments': 'Service Assignments',
  '/service-history': 'Service History',
  '/engineers': 'Engineers',
  '/analytics': 'Analytics',
  '/users': 'User Management',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
}

export default function Header({ onMenuToggle, notifCount = 0 }: HeaderProps) {
  const { profile } = useAuth()
  const location = useLocation()

  const breadcrumb = BREADCRUMBS[location.pathname] ?? 'Biocare SMS'

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 px-4 flex items-center gap-4 sticky top-0 z-10">
      {/* Mobile menu button */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Breadcrumb */}
      <div className="flex-1">
        <h1 className="text-base font-semibold text-slate-200">{breadcrumb}</h1>
        <p className="text-xs text-slate-500">Biocare Health Systems</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Link
          to="/notifications"
          className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Bell size={18} />
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-biocare-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </Link>

        {/* Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-biocare-purple-500/30 border border-biocare-purple-500/50 flex items-center justify-center">
            <span className="text-xs font-bold text-biocare-purple-300">
              {profile?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-slate-200 leading-tight">{profile?.name}</p>
            <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
