import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import supabase from '@/lib/supabase'
import { PageSpinner } from '@/components/ui/Spinner'

interface CalEvent {
  id: string
  date: string
  facilityName: string
  model: string
  serialNumber: string
  saleType: string
  assignmentId?: string
  engineerName?: string
  status?: string
  daysOverdue?: number
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function saleColor(saleType: string) {
  if (saleType === 'cash') return 'bg-emerald-500/20 text-emerald-300 border-l-2 border-emerald-500'
  if (saleType === 'placement') return 'bg-orange-500/20 text-orange-300 border-l-2 border-orange-500'
  return 'bg-blue-500/20 text-blue-300 border-l-2 border-blue-500'
}

export default function MaintenanceCalendar() {
  const navigate = useNavigate()
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [filterEngineer, setFilterEngineer] = useState('')
  const [filterRegion, setFilterRegion] = useState('')

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  // Fetch equipment with service dates and assignments
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['calendar-events', year, month],
    queryFn: async () => {
      const start = new Date(year, month, 1).toISOString().split('T')[0]
      const end   = new Date(year, month + 1, 0).toISOString().split('T')[0]

      // Equipment due this month
      const { data: equip } = await supabase
        .from('equipment')
        .select('id, serial_number, facility_name, sale_type, next_service_date, subcategory_id, region_id')
        .gte('next_service_date', start)
        .lte('next_service_date', end)
        .eq('status', 'active')

      // Also overdue equipment (before start of month)
      const todayStr = today.toISOString().split('T')[0]
      const { data: overdue } = start <= todayStr ? await supabase
        .from('equipment')
        .select('id, serial_number, facility_name, sale_type, next_service_date, subcategory_id, region_id')
        .lt('next_service_date', start)
        .eq('status', 'active')
        .order('next_service_date') : { data: [] }

      const allEquip = [...(equip ?? []), ...(overdue ?? [])]
      if (!allEquip.length) return []

      const equipIds = allEquip.map(e => e.id)
      const subIds   = [...new Set(allEquip.map(e => e.subcategory_id).filter(Boolean))]

      const [{ data: assignments }, { data: subs }] = await Promise.all([
        supabase.from('service_assignments')
          .select('id, equipment_id, engineer_id, scheduled_date, status')
          .in('equipment_id', equipIds)
          .in('status', ['pending', 'scheduled', 'in_progress']),
        subIds.length ? supabase.from('subcategories').select('id, name').in('id', subIds) : { data: [] },
      ])

      const engIds = [...new Set((assignments ?? []).map((a: any) => a.engineer_id).filter(Boolean))]
      const { data: engs } = engIds.length
        ? await supabase.from('profiles').select('id, name').in('id', engIds)
        : { data: [] }

      return allEquip.map(e => {
        const assignment = assignments?.find((a: any) => a.equipment_id === e.id)
        const engineer   = engs?.find((en: any) => en.id === assignment?.engineer_id)
        const dueDate    = new Date(e.next_service_date)
        const isOverdue  = dueDate < today
        return {
          id: e.id,
          date: e.next_service_date,
          facilityName: e.facility_name,
          model: subs?.find((s: any) => s.id === e.subcategory_id)?.name ?? '—',
          serialNumber: e.serial_number,
          saleType: e.sale_type,
          assignmentId: assignment?.id,
          engineerName: engineer?.name,
          status: isOverdue ? 'overdue' : (assignment ? assignment.status : 'unassigned'),
          daysOverdue: isOverdue ? Math.round((today.getTime() - dueDate.getTime()) / 86400000) : undefined,
        } as CalEvent
      })
    },
    retry: 2,
  })

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers-cal'],
    queryFn: async () => { const { data } = await supabase.from('profiles').select('id, name').eq('role', 'engineer').order('name'); return data ?? [] },
  })

  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => { const { data } = await supabase.from('regions').select('id, name').order('name'); return data ?? [] },
  })

  // Build calendar grid
  const firstDay  = new Date(year, month, 1).getDay()  // 0=Sun
  const daysInMon = new Date(year, month + 1, 0).getDate()
  const grid: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMon }, (_, i) => i + 1)]
  while (grid.length % 7 !== 0) grid.push(null)

  const eventsForDay = (day: number): CalEvent[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.date === dateStr)
  }

  const overdueEvents = events.filter(e => e.status === 'overdue')

  const prev = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const next = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Maintenance Calendar</h1>
          <p className="text-slate-500 text-sm">{events.length} services this month</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="btn-secondary h-9 w-9 p-0 justify-center"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-slate-200 min-w-[140px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={next} className="btn-secondary h-9 w-9 p-0 justify-center"><ChevronRight size={16} /></button>
          <button onClick={() => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="btn-secondary text-sm h-9 px-3">Today</button>
        </div>
      </div>

      {/* Overdue banner */}
      {overdueEvents.length > 0 && (
        <div className="card p-4 border-red-500/30 bg-red-500/10 flex items-center gap-3">
          <span className="text-red-400 font-semibold text-sm">{overdueEvents.length} overdue services</span>
          <div className="flex flex-wrap gap-1">
            {overdueEvents.slice(0, 5).map(e => (
              <button key={e.id} onClick={() => navigate(`/equipment/${e.id}`)}
                className="badge bg-red-500/20 text-red-400 border border-red-500/30 text-xs hover:bg-red-500/30 transition-colors">
                {e.facilityName} ({e.daysOverdue}d)
              </button>
            ))}
            {overdueEvents.length > 5 && <span className="text-xs text-red-400">+{overdueEvents.length - 5} more</span>}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
        {[['bg-emerald-500', 'Cash Sale'], ['bg-orange-500', 'Placement'], ['bg-blue-500', 'Hire Purchase']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${c}`} />{l}</span>
        ))}
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Overdue</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500" />Unassigned</span>
      </div>

      {/* Calendar grid */}
      <div className="card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-800">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">{d}</div>
          ))}
        </div>

        {/* Weeks */}
        <div className="grid grid-cols-7 divide-x divide-slate-800">
          {grid.map((day, idx) => {
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            const dayEvents = day ? eventsForDay(day) : []
            return (
              <div key={idx}
                className={`min-h-[100px] p-1.5 border-b border-slate-800 ${!day ? 'bg-slate-900/30' : 'hover:bg-slate-800/20 transition-colors'}`}>
                {day && (
                  <>
                    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium mb-1 ${
                      isToday ? 'bg-biocare-purple-500 text-white' : 'text-slate-400'}`}>
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(e => (
                        <button key={e.id} onClick={() => navigate(`/equipment/${e.id}`)}
                          className={`w-full text-left rounded px-1 py-0.5 text-[10px] truncate hover:opacity-80 transition-opacity ${
                            e.status === 'overdue' ? 'bg-red-500/20 text-red-300 border-l-2 border-red-500' :
                            e.status === 'unassigned' ? 'bg-slate-700/50 text-slate-400 border-l-2 border-slate-600' :
                            saleColor(e.saleType)}`}>
                          {e.facilityName}
                          {e.engineerName && <span className="opacity-60"> · {e.engineerName.split(' ')[0]}</span>}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] text-slate-600 pl-1">+{dayEvents.length - 3} more</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Monthly list view */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-2">
          <Calendar size={18} className="text-biocare-cyan-400" />
          <h2 className="section-title">This Month — All Services</h2>
          <span className="badge bg-slate-700/50 text-slate-400 border border-slate-700">{events.filter(e => e.status !== 'overdue').length}</span>
        </div>
        {!events.filter(e => e.status !== 'overdue').length ? (
          <div className="p-8 text-center text-slate-500 text-sm">No services scheduled for this month.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {events.filter(e => e.status !== 'overdue').sort((a, b) => a.date.localeCompare(b.date)).map(e => (
              <div key={e.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/equipment/${e.id}`)}>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-200">{e.facilityName}</span>
                    <span className={`badge text-xs ${saleColor(e.saleType)}`}>{e.saleType.replace('_', ' ')}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{e.model} • S/N: {e.serialNumber}</p>
                  {e.engineerName && <p className="text-xs text-biocare-cyan-400 mt-0.5">👷 {e.engineerName}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-200">
                    {new Date(e.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                  </p>
                  <span className={`badge text-xs ${e.status === 'unassigned' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {e.status === 'unassigned' ? 'Unassigned' : e.status?.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
