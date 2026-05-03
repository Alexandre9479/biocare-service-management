import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, CheckCircle, Calendar, Clock, ChevronRight, Wrench, Phone, MapPin } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import StatCard from '@/components/dashboard/StatCard'
import SaleTypeBadge from '@/components/equipment/SaleTypeBadge'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, getServiceTypeLabel } from '@/utils/helpers'

export default function EngineerDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const { data: assignments = [], isLoading, error } = useQuery({
    queryKey: ['my-assignments', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return []
      // Fetch assignments first
      const { data: assignData, error: aErr } = await supabase
        .from('service_assignments')
        .select('id, equipment_id, scheduled_date, service_type, status, priority, special_instructions, assigned_at')
        .eq('engineer_id', profile.id)
        .neq('status', 'cancelled')
        .order('scheduled_date', { ascending: true })
      if (aErr) throw aErr
      if (!assignData?.length) return []

      // Fetch equipment details separately
      const equipIds = assignData.map(a => a.equipment_id).filter(Boolean)
      const { data: equips } = await supabase
        .from('equipment')
        .select('id, serial_number, facility_name, sale_type, status, facility_contact_phone, facility_address, subcategory_id, region_id')
        .in('id', equipIds)

      const subcatIds = [...new Set((equips ?? []).map(e => e.subcategory_id).filter(Boolean))]
      const regionIds = [...new Set((equips ?? []).map(e => e.region_id).filter(Boolean))]

      const [{ data: subs }, { data: regions }] = await Promise.all([
        subcatIds.length ? supabase.from('subcategories').select('id, name').in('id', subcatIds) : { data: [] },
        regionIds.length ? supabase.from('regions').select('id, name').in('id', regionIds) : { data: [] },
      ])

      return assignData.map(a => {
        const eq = equips?.find(e => e.id === a.equipment_id)
        return {
          ...a,
          equipment: eq ? {
            ...eq,
            subcategory: subs?.find(s => s.id === eq.subcategory_id),
            region: regions?.find(r => r.id === eq.region_id),
          } : null,
        }
      })
    },
    enabled: !!profile?.id,
    retry: 2,
  })

  const { data: completedCount = 0 } = useQuery({
    queryKey: ['my-completed-count', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return 0
      const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      const { count } = await supabase
        .from('service_logs')
        .select('id', { count: 'exact', head: true })
        .eq('engineer_id', profile.id)
        .gte('service_date', firstDay)
      return count ?? 0
    },
    enabled: !!profile?.id,
    retry: 2,
  })

  const today = new Date().toISOString().split('T')[0]
  const pending = assignments.filter((a: any) => !['completed', 'cancelled'].includes(a.status))
  const todayJobs = pending.filter((a: any) => a.scheduled_date === today)
  const upcoming = pending.filter((a: any) => a.scheduled_date && a.scheduled_date > today)
  const inProgress = pending.filter((a: any) => a.status === 'in_progress')

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <p className="text-red-400 text-sm">Failed to load assignments. Please refresh.</p>
        <p className="text-xs text-slate-600">{String(error)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">My Dashboard</h1>
        <p className="text-slate-500 text-sm">Welcome back, {profile?.name?.split(' ')[0]}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="My Assignments" value={isLoading ? '…' : pending.length}
          icon={<ClipboardList size={20} />} iconBg="bg-biocare-purple-500/20" />
        <StatCard title="Today's Jobs" value={isLoading ? '…' : todayJobs.length}
          icon={<Calendar size={20} />} iconBg="bg-orange-500/20" />
        <StatCard title="In Progress" value={isLoading ? '…' : inProgress.length}
          icon={<Wrench size={20} />} iconBg="bg-blue-500/20" />
        <StatCard title="Done This Month" value={isLoading ? '…' : completedCount}
          icon={<CheckCircle size={20} />} iconBg="bg-emerald-500/20" />
      </div>

      {/* Today */}
      {todayJobs.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
            <Calendar size={18} className="text-orange-400" />
            <h2 className="section-title">Today's Jobs</h2>
            <span className="badge bg-orange-500/20 text-orange-400 border border-orange-500/30">{todayJobs.length}</span>
          </div>
          <div className="divide-y divide-slate-800">
            {todayJobs.map((a: any) => <AssignmentRow key={a.id} assignment={a} onLog={() => navigate(`/service/log/${a.id}`)} />)}
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
          <Clock size={18} className="text-biocare-cyan-400" />
          <h2 className="section-title">Upcoming Assignments</h2>
          {!isLoading && <span className="badge bg-slate-700/50 text-slate-400 border border-slate-700">{upcoming.length}</span>}
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-biocare-purple-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : !upcoming.length ? (
          <EmptyState icon={<CheckCircle size={28} />} title="No upcoming assignments"
            description="New assignments will appear here when admin assigns them to you." />
        ) : (
          <div className="divide-y divide-slate-800">
            {upcoming.map((a: any) => <AssignmentRow key={a.id} assignment={a} onLog={() => navigate(`/service/log/${a.id}`)} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function AssignmentRow({ assignment: a, onLog }: { assignment: any; onLog: () => void }) {
  const eq = a.equipment
  return (
    <div className="px-5 py-4 hover:bg-slate-800/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-slate-200">{eq?.facility_name ?? 'Unknown Facility'}</span>
            {eq?.sale_type && <SaleTypeBadge saleType={eq.sale_type} />}
            {a.priority === 'urgent' && <span className="badge bg-red-500/20 text-red-400 border border-red-500/30">URGENT</span>}
          </div>
          <p className="text-xs text-slate-400">{eq?.subcategory?.name ?? '—'} • S/N: {eq?.serial_number ?? '—'}</p>
          {eq?.facility_address && (
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin size={11} />{eq.facility_address}</p>
          )}
          {eq?.facility_contact_phone && (
            <a href={`tel:${eq.facility_contact_phone}`} className="text-xs text-biocare-cyan-400 flex items-center gap-1 mt-0.5">
              <Phone size={11} />{eq.facility_contact_phone}
            </a>
          )}
          <p className="text-xs text-slate-500 mt-1">
            <Calendar size={11} className="inline mr-1" />
            {formatDate(a.scheduled_date)} {a.service_type && `• ${getServiceTypeLabel(a.service_type)}`}
          </p>
          {a.special_instructions && (
            <p className="text-xs text-amber-400/80 mt-1">⚠️ {a.special_instructions}</p>
          )}
        </div>
        <button onClick={onLog} className="btn-primary text-xs py-1.5 px-3 flex-shrink-0">
          Log Service <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
