import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, Wrench, Users, BarChart3,
  Settings, Bell, ChevronLeft, ChevronRight, ClipboardList,
  UserCog, LogOut, Stethoscope, CalendarDays, Boxes
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/utils/cn'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
  badge?: number
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  pendingCount?: number
  notifCount?: number
}

export default function Sidebar({ collapsed, onToggle, pendingCount = 0, notifCount = 0 }: SidebarProps) {
  const { profile, logout } = useAuth()
  const location = useLocation()

  const navItems: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/equipment', label: 'Equipment', icon: <Package size={18} /> },
    { to: '/assignments', label: 'Assignments', icon: <ClipboardList size={18} />, adminOnly: true, badge: pendingCount },
    { to: '/calendar', label: 'Service Calendar', icon: <CalendarDays size={18} />, adminOnly: true },
    { to: '/service-history', label: 'Service History', icon: <Wrench size={18} /> },
    { to: '/parts', label: 'Parts Inventory', icon: <Boxes size={18} />, adminOnly: true },
    { to: '/engineers', label: 'Engineers', icon: <Stethoscope size={18} />, adminOnly: true },
    { to: '/analytics', label: 'Analytics', icon: <BarChart3 size={18} />, adminOnly: true },
    { to: '/users', label: 'User Management', icon: <UserCog size={18} />, adminOnly: true },
    { to: '/notifications', label: 'Notifications', icon: <Bell size={18} />, badge: notifCount },
    { to: '/settings', label: 'Settings', icon: <Settings size={18} />, adminOnly: true },
  ]

  const visible = navItems.filter(item => !item.adminOnly || profile?.role === 'admin')

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-slate-900 border-r border-slate-800 transition-all duration-300 sticky top-0',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center justify-center border-b border-slate-800',
        collapsed ? 'px-2 py-3 min-h-[64px]' : 'px-3 py-3 min-h-[64px]'
      )}>
        {collapsed ? (
          /* Collapsed: just the microscope icon from the logo */
          <div className="w-9 h-9 rounded-xl bg-biocare-gradient flex items-center justify-center flex-shrink-0 glow-purple">
            <Stethoscope size={20} className="text-white" />
          </div>
        ) : (
          /* Expanded: real Biocare logo on dark bg */
          <div className="w-full bg-white/95 rounded-xl px-2 py-1.5">
            <img
              src="/biocare-logo.png"
              alt="Biocare Health Systems"
              className="w-full h-8 object-contain object-left"
            />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {visible.map(item => {
          const isActive = location.pathname === item.to ||
            (item.to !== '/dashboard' && location.pathname.startsWith(item.to))

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'nav-item relative',
                isActive && 'nav-item-active',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
              {item.badge && item.badge > 0 ? (
                <span className={cn(
                  'flex items-center justify-center rounded-full bg-biocare-red-500 text-white text-xs font-bold',
                  collapsed ? 'absolute top-1 right-1 w-4 h-4 text-[10px]' : 'ml-auto w-5 h-5'
                )}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
            </NavLink>
          )
        })}
      </nav>

      {/* User Info */}
      <div className={cn(
        'border-t border-slate-800 p-3',
        collapsed && 'flex justify-center'
      )}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-biocare-purple-500/30 border border-biocare-purple-500/50 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-biocare-purple-300">
                {profile?.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-200 truncate">{profile?.name ?? 'User'}</p>
              <p className="text-xs text-slate-500 capitalize">{profile?.role ?? 'engineer'}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors shadow-lg z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
