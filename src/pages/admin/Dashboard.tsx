import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Package, AlertTriangle, ClipboardCheck,
  Clock, DollarSign, ChevronRight, UserCheck, ShieldAlert
} from 'lucide-react'
import supabase from '@/lib/supabase'
import StatCard from '@/components/dashboard/StatCard'
import SaleTypeBadge from '@/components/equipment/SaleTypeBadge'
import { formatDate, formatCurrency, getDaysUntilService } from '@/utils/helpers'
import type { Equipment, ServiceAssignment } from '@/types'

async function fetchDashboardStats() {
  const [equipRes, pendingRes, logsRes] = await Promise.all([
    supabase.from('equipment').select('id, sale_type, status, next_service_date'),
    supabase.from('service_assignments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('service_logs').select('id, total_charge, service_date')
      .gte('service_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
  ])

  const eq = equipRes.data ?? []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

  return {
    total: eq.length,
    cash: eq.filter(e => e.sale_type === 'cash').length,
    placement: eq.filter(e => e.sale_type === 'placement').length,
    hire_purchase: eq.filter(e => e.sale_type === 'hire_purchase').length,
    pendingAssignments: pendingRes.count ?? 0,
    upcoming: eq.filter(e => { if (!e.next_service_date) return false; const d = new Date(e.next_service_date); return d >= today && d <= in7Days }).length,
    overdue: eq.filter(e => e.next_service_date && new Date(e.next_service_date) < today).length,
    completedThisMonth: logsRes.data?.length ?? 0,
    revenueThisMonth: (logsRes.data ?? []).reduce((s, l) => s + (l.total_charge ?? 0), 0),
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate()

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 60000,
    retry: 2,
  })

  const { data: pendingAssignments, isLoading: assignLoading } = useQuery({
    queryKey: ['pending-assignments-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_assignments')
        .select('id, equipment_id, status, priority, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(8)
      if (error) throw error

      // Fetch equipment details separately to avoid join issues
      const equipIds = (data ?? []).map(a => a.equipment_id).filter(Boolean)
      if (!equipIds.length) return []

      const { data: equips } = await supabase
        .from('equipment')
        .select('id, serial_number, facility_name, sale_type, next_service_date, region_id')
        .in('id', equipIds)

      const { data: regions } = await supabase
        .from('regions')
        .select('id, name')

      const { data: subs } = await supabase
        .from('subcategories')
        .select('id, name')

      return (data ?? []).map(a => ({
        ...a,
        equipment: equips?.find(e => e.id === a.equipment_id),
        region: regions?.find(r => r.id === equips?.find(e => e.id === a.equipment_id)?.region_id),
      }))
    },
    retry: 2,
  })

  const { data: overdueEquipment } = useQuery({
    queryKey: ['overdue-equipment-dashboard'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('equipment')
        .select('id, serial_number, facility_name, sale_type, status, next_service_date, subcategory_id')
        .lt('next_service_date', today)
        .eq('status', 'active')
        .order('next_service_date', { ascending: true })
        .limit(5)
      if (error) throw error
      return (data ?? []) as Equipment[]
    },
    retry: 2,
  })

  // Warranty expiry alerts — equipment whose warranty expires within 90 days
  const { data: warrantyAlerts = [] } = useQuery({
    queryKey: ['warranty-alerts-dashboard'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const in90  = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
      const { data } = await supabase
        .from('equipment')
        .select('id, serial_number, facility_name, sale_type, warranty_expiry_date, subcategory_id')
        .gte('warranty_expiry_date', today)
        .lte('warranty_expiry_date', in90)
        .eq('status', 'active')
        .order('warranty_expiry_date', { ascending: true })
        .limit(8)
      if (!data?.length) return []
      const subIds = [...new Set(data.map(e => e.subcategory_id).filter(Boolean))]
      const { data: subs } = subIds.length
        ? await supabase.from('subcategories').select('id, name').in('id', subIds)
        : { data: [] }
      return data.map(e => ({
        ...e,
        subcategory: subs?.find((s: any) => s.id === e.subcategory_id),
        daysLeft: Math.round((new Date(e.warranty_expiry_date).getTime() - Date.now()) / 86400000),
      }))
    },
    retry: 2,
  })

  if (statsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle size={40} className="text-red-400" />
        <p className="text-slate-400">Failed to load dashboard. Check your Supabase connection.</p>
        <p className="text-xs text-slate-600">{String(statsError)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-slate-500 text-sm">{new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Equipment" value={statsLoading ? '…' : stats?.total ?? 0}
          icon={<Package size={20} />} iconBg="bg-biocare-purple-500/20" onClick={() => navigate('/equipment')} />
        <StatCard title="Pending Assignments" value={statsLoading ? '…' : stats?.pendingAssignments ?? 0}
          subtitle="Needs engineer" icon={<ClipboardCheck size={20} />} iconBg="bg-orange-500/20" onClick={() => navigate('/assignments')} />
        <StatCard title="Overdue Services" value={statsLoading ? '…' : stats?.overdue ?? 0}
          subtitle="Past due date" icon={<AlertTriangle size={20} />} iconBg="bg-red-500/20" />
        <StatCard title="Revenue This Month" value={statsLoading ? '…' : formatCurrency(stats?.revenueThisMonth ?? 0)}
          subtitle={`${stats?.completedThisMonth ?? 0} services`} icon={<DollarSign size={20} />} iconBg="bg-emerald-500/20" />
      </div>

      {/* Sale type breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Cash Sales', count: stats?.cash ?? 0, color: 'text-emerald-400', bg: 'bg-emerald-500/20', dot: 'bg-emerald-400', desc: 'Customer pays for service' },
          { label: 'Placement', count: stats?.placement ?? 0, color: 'text-orange-400', bg: 'bg-orange-500/20', dot: 'bg-orange-400', desc: 'Free servicing' },
          { label: 'Hire Purchase', count: stats?.hire_purchase ?? 0, color: 'text-blue-400', bg: 'bg-blue-500/20', dot: 'bg-blue-400', desc: 'Conditional servicing' },
        ].map(s => (
          <div key={s.label} className="card p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center`}>
              <span className={`text-2xl font-bold ${s.color}`}>{statsLoading ? '…' : s.count}</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className="text-sm font-semibold text-slate-200">{s.label}</span>
              </div>
              <p className="text-xs text-slate-500">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: Pending assignments + Overdue */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={18} className="text-orange-400" />
              <h2 className="section-title">Pending Assignments</h2>
              {(stats?.pendingAssignments ?? 0) > 0 && (
                <span className="badge bg-orange-500/20 text-orange-400 border border-orange-500/30">{stats?.pendingAssignments}</span>
              )}
            </div>
            <button onClick={() => navigate('/assignments')} className="text-xs text-biocare-cyan-400 hover:text-biocare-cyan-300 flex items-center gap-1">
              View all <ChevronRight size={14} />
            </button>
          </div>

          {assignLoading ? (
            <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-biocare-purple-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : !pendingAssignments?.length ? (
            <div className="p-8 text-center"><UserCheck size={32} className="text-emerald-500 mx-auto mb-2" /><p className="text-sm text-slate-400">All services assigned!</p></div>
          ) : (
            <div className="divide-y divide-slate-800">
              {pendingAssignments.map((a: any) => {
                const eq = a.equipment
                const days = getDaysUntilService(eq?.next_service_date)
                return (
                  <div key={a.id} className="px-5 py-3 hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-200 truncate">{eq?.facility_name ?? 'Unknown'}</span>
                          {eq?.sale_type && <SaleTypeBadge saleType={eq.sale_type} />}
                        </div>
                        <p className="text-xs text-slate-500">S/N: {eq?.serial_number} • {a.region?.name}</p>
                        <p className="text-xs text-slate-500">Due: {formatDate(eq?.next_service_date)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className={`badge text-xs ${days < 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
                          {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                        </span>
                        <button onClick={() => navigate('/assignments')} className="btn-cyan text-xs py-1 px-3">Assign</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400" />
              <h2 className="section-title">Overdue Services</h2>
            </div>
            <button onClick={() => navigate('/equipment')} className="text-xs text-biocare-cyan-400 hover:text-biocare-cyan-300 flex items-center gap-1">
              View all <ChevronRight size={14} />
            </button>
          </div>

          {!overdueEquipment?.length ? (
            <div className="p-8 text-center"><Clock size={32} className="text-emerald-500 mx-auto mb-2" /><p className="text-sm text-slate-400">No overdue services!</p></div>
          ) : (
            <div className="divide-y divide-slate-800">
              {overdueEquipment.map(e => {
                const days = Math.abs(getDaysUntilService(e.next_service_date))
                return (
                  <div key={e.id} className="px-5 py-3 hover:bg-slate-800/40 transition-colors cursor-pointer" onClick={() => navigate(`/equipment/${e.id}`)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{e.facility_name}</p>
                        <p className="text-xs text-slate-500">S/N: {e.serial_number} • Due: {formatDate(e.next_service_date)}</p>
                      </div>
                      <span className="badge bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0">{days}d overdue</span>
                    </div>
                    <div className="mt-1"><SaleTypeBadge saleType={e.sale_type} /></div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Warranty Expiry Alerts */}
      {warrantyAlerts.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-amber-400" />
              <h2 className="section-title">Warranty Expiring Soon</h2>
              <span className="badge bg-amber-500/20 text-amber-400 border border-amber-500/30">{warrantyAlerts.length}</span>
            </div>
            <button onClick={() => navigate('/equipment')} className="text-xs text-biocare-cyan-400 hover:text-biocare-cyan-300 flex items-center gap-1">
              View equipment <ChevronRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-slate-800">
            {warrantyAlerts.map((e: any) => (
              <div key={e.id}
                className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/equipment/${e.id}`)}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-200 truncate">{e.facility_name}</span>
                    <SaleTypeBadge saleType={e.sale_type} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {e.subcategory?.name} • S/N: {e.serial_number} • Expires: {formatDate(e.warranty_expiry_date)}
                  </p>
                </div>
                <span className={`badge flex-shrink-0 ${
                  e.daysLeft <= 30  ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  e.daysLeft <= 60  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                      'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {e.daysLeft}d left
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
