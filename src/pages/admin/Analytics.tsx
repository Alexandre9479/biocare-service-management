import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { BarChart3, TrendingUp, Package, DollarSign } from 'lucide-react'
import supabase from '@/lib/supabase'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/utils/helpers'

const COLORS = { cash: '#10B981', placement: '#F59E0B', hire_purchase: '#3B82F6' }
const CHART_COLORS = ['#7B2D8B', '#00ACC1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

export default function Analytics() {
  const [dateRange, setDateRange] = useState('6')

  const { data: equipmentData, isLoading } = useQuery({
    queryKey: ['analytics-equipment'],
    queryFn: async () => {
      const { data } = await supabase
        .from('equipment')
        .select('sale_type, status, category:category_id(name), region:region_id(name), created_at')
      return data ?? []
    },
  })

  const { data: serviceData } = useQuery({
    queryKey: ['analytics-services', dateRange],
    queryFn: async () => {
      const months = parseInt(dateRange)
      const from = new Date()
      from.setMonth(from.getMonth() - months)
      const { data } = await supabase
        .from('service_logs')
        .select('service_date, total_charge, service_type, charge_status, equipment:equipment_id(sale_type)')
        .gte('service_date', from.toISOString().split('T')[0])
        .order('service_date')
      return data ?? []
    },
  })

  const { data: engineerData } = useQuery({
    queryKey: ['analytics-engineers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('service_logs')
        .select('engineer:engineer_id(name), service_date, total_charge')
      return data ?? []
    },
  })

  if (isLoading) return <PageSpinner />

  // Sale type distribution
  const saleTypePie = [
    { name: 'Cash Sale', value: equipmentData?.filter(e => e.sale_type === 'cash').length ?? 0, color: COLORS.cash },
    { name: 'Placement', value: equipmentData?.filter(e => e.sale_type === 'placement').length ?? 0, color: COLORS.placement },
    { name: 'Hire Purchase', value: equipmentData?.filter(e => e.sale_type === 'hire_purchase').length ?? 0, color: COLORS.hire_purchase },
  ]

  // Monthly revenue trend
  const months: Record<string, { month: string; revenue: number; count: number }> = {}
  serviceData?.forEach(s => {
    const key = s.service_date?.slice(0, 7) ?? ''
    if (!key) return
    if (!months[key]) months[key] = { month: key, revenue: 0, count: 0 }
    months[key].revenue += s.total_charge ?? 0
    months[key].count++
  })
  const monthlyTrend = Object.values(months).sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({ ...m, month: new Date(m.month + '-01').toLocaleDateString('en-KE', { month: 'short', year: '2-digit' }) }))

  // Category breakdown
  const catMap: Record<string, number> = {}
  equipmentData?.forEach(e => {
    const cat = (e as any).category?.name ?? 'Unknown'
    catMap[cat] = (catMap[cat] ?? 0) + 1
  })
  const categoryBar = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }))

  // Region breakdown
  const regionMap: Record<string, number> = {}
  equipmentData?.forEach(e => {
    const r = (e as any).region?.name ?? 'No Region'
    regionMap[r] = (regionMap[r] ?? 0) + 1
  })
  const regionBar = Object.entries(regionMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name: name.replace(' Region', ''), count }))

  // Engineer performance
  const engMap: Record<string, { name: string; count: number; revenue: number }> = {}
  engineerData?.forEach(s => {
    const eng = (s as any).engineer?.name ?? 'Unknown'
    if (!engMap[eng]) engMap[eng] = { name: eng, count: 0, revenue: 0 }
    engMap[eng].count++
    engMap[eng].revenue += s.total_charge ?? 0
  })
  const engineerPerf = Object.values(engMap).sort((a, b) => b.count - a.count).slice(0, 8)

  const totalRevenue = serviceData?.reduce((s, l) => s + (l.total_charge ?? 0), 0) ?? 0
  const freeServices = serviceData?.filter(l => !l.total_charge || l.total_charge === 0).length ?? 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Analytics & Reports</h1>
          <p className="text-slate-500 text-sm">Equipment and service performance insights</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">Period:</label>
          <select value={dateRange} onChange={e => setDateRange(e.target.value)}
            className="input-field text-sm h-9 w-auto">
            <option value="3">Last 3 months</option>
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
          </select>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <Package size={18} className="text-biocare-purple-400" />
          <p className="text-2xl font-bold text-slate-50">{equipmentData?.length ?? 0}</p>
          <p className="text-xs text-slate-500">Total Equipment</p>
        </div>
        <div className="stat-card">
          <BarChart3 size={18} className="text-biocare-cyan-400" />
          <p className="text-2xl font-bold text-slate-50">{serviceData?.length ?? 0}</p>
          <p className="text-xs text-slate-500">Services in Period</p>
        </div>
        <div className="stat-card">
          <DollarSign size={18} className="text-emerald-400" />
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-slate-500">Revenue in Period</p>
        </div>
        <div className="stat-card">
          <TrendingUp size={18} className="text-orange-400" />
          <p className="text-2xl font-bold text-orange-400">{freeServices}</p>
          <p className="text-xs text-slate-500">Free Services</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Sale Type Pie */}
        <div className="card p-5">
          <h3 className="section-title mb-4">Equipment by Sale Type</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={saleTypePie} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                paddingAngle={3} dataKey="value">
                {saleTypePie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', color: '#F1F5F9' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {saleTypePie.map(s => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-xs text-slate-400">{s.name}</span>
                </div>
                <span className="text-xs font-semibold text-slate-200">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="card p-5 md:col-span-2">
          <h3 className="section-title mb-4">Monthly Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', color: '#F1F5F9' }}
                formatter={(v: any) => [formatCurrency(v), 'Revenue']}
              />
              <Line type="monotone" dataKey="revenue" stroke="#7B2D8B" strokeWidth={2} dot={{ fill: '#7B2D8B' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Category Breakdown */}
        <div className="card p-5">
          <h3 className="section-title mb-4">Equipment by Category</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={categoryBar} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} width={75} />
              <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', color: '#F1F5F9' }} />
              <Bar dataKey="count" fill="#00ACC1" radius={[0, 4, 4, 0]}>
                {categoryBar.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Regional Distribution */}
        <div className="card p-5">
          <h3 className="section-title mb-4">Equipment by Region</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={regionBar}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', color: '#F1F5F9' }} />
              <Bar dataKey="count" fill="#7B2D8B" radius={[4, 4, 0, 0]}>
                {regionBar.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Engineer Performance */}
      {engineerPerf.length > 0 && (
        <div className="card p-5">
          <h3 className="section-title mb-4">Engineer Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="table-header text-left py-3 px-2">Engineer</th>
                  <th className="table-header text-center py-3 px-2">Services</th>
                  <th className="table-header text-right py-3 px-2">Revenue Generated</th>
                </tr>
              </thead>
              <tbody>
                {engineerPerf.map((eng, i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-3 px-2 text-slate-200 font-medium">{eng.name}</td>
                    <td className="py-3 px-2 text-center">
                      <span className="badge bg-biocare-purple-500/20 text-biocare-purple-400 border border-biocare-purple-500/30">
                        {eng.count}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right text-emerald-400 font-semibold">{formatCurrency(eng.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
