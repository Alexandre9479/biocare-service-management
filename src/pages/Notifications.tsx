import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Wrench, AlertTriangle, UserCheck, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import supabase from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate } from '@/utils/helpers'
import type { Notification } from '@/types'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  assignment: <UserCheck size={15} className="text-biocare-cyan-400" />,
  service_due: <Wrench size={15} className="text-orange-400" />,
  overdue: <AlertTriangle size={15} className="text-red-400" />,
  completion: <CheckCheck size={15} className="text-emerald-400" />,
  system: <Info size={15} className="text-slate-400" />,
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-blue-500',
  low: 'border-l-slate-700',
}

export default function Notifications() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(100)
      return data as Notification[]
    },
    enabled: !!profile?.id,
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', profile!.id)
        .eq('is_read', false)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['unread-notifications-count'] })
    },
  })

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['unread-notifications-count'] })
  }

  const handleClick = (notif: Notification) => {
    markRead(notif.id)
    const data = notif.data as any
    if (data?.equipment_id) navigate(`/equipment/${data.equipment_id}`)
    else if (data?.assignment_id) navigate('/assignments')
  }

  if (isLoading) return <PageSpinner />

  const unread = notifications?.filter(n => !n.is_read).length ?? 0

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="text-slate-500 text-sm">{unread} unread</p>
        </div>
        {unread > 0 && (
          <button onClick={() => markAllRead.mutate()} className="btn-secondary text-sm">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {!notifications?.length ? (
        <EmptyState icon={<Bell size={28} />} title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              className={`card border-l-4 ${PRIORITY_COLORS[n.priority] ?? 'border-l-slate-700'} p-4 cursor-pointer
                hover:bg-slate-800/60 transition-all duration-200 ${!n.is_read ? 'bg-slate-800/40' : 'bg-slate-900/40 opacity-70'}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{TYPE_ICONS[n.type] ?? <Bell size={15} className="text-slate-500" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium ${!n.is_read ? 'text-slate-100' : 'text-slate-300'}`}>
                      {n.title}
                    </p>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-biocare-purple-500 flex-shrink-0 mt-1" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-slate-600 mt-1">{formatDate(n.created_at)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
