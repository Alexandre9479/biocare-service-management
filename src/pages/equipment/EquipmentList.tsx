import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Package, Plus, Upload, Search, Filter, ChevronRight, AlertTriangle, CheckCircle, Clock, X, ScanLine, QrCode, CheckSquare, Square, Layers, ChevronDown } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import SaleTypeBadge from '@/components/equipment/SaleTypeBadge'
import StatusBadge from '@/components/equipment/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, getDaysUntilService, getServiceUrgency } from '@/utils/helpers'
import type { SaleType, EquipmentStatus } from '@/types'
import toast from 'react-hot-toast'

export default function EquipmentList() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Bulk select state
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkAction, setBulkAction] = useState('')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterSale, setFilterSale] = useState<SaleType | ''>('')
  const [filterStatus, setFilterStatus] = useState<EquipmentStatus | ''>('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterUrgency, setFilterUrgency] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data } = await supabase.from('regions').select('id, name').eq('is_active', true).order('name')
      return data ?? []
    },
  })

  // Load all supporting data in one go
  const { data: meta } = useQuery({
    queryKey: ['equipment-meta'],
    queryFn: async () => {
      const [{ data: cats }, { data: subs }] = await Promise.all([
        supabase.from('categories').select('id, name'),
        supabase.from('subcategories').select('id, name, category_id'),
      ])
      return { cats: cats ?? [], subs: subs ?? [] }
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: equipment = [], isLoading, error } = useQuery({
    queryKey: ['equipment-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('id, serial_number, facility_name, sale_type, status, next_service_date, installation_date, region_id, subcategory_id, hp_payment_status')
        .order('facility_name')
      if (error) throw error
      return data ?? []
    },
    retry: 2,
  })

  const enriched = useMemo(() => {
    return equipment.map(e => ({
      ...e,
      subcategory: meta?.subs.find(s => s.id === e.subcategory_id),
      region: regions.find((r: any) => r.id === e.region_id),
    }))
  }, [equipment, meta, regions])

  const filtered = useMemo(() => enriched.filter(e => {
    if (search) {
      const s = search.toLowerCase()
      if (!e.facility_name?.toLowerCase().includes(s) &&
        !e.serial_number?.toLowerCase().includes(s) &&
        !e.subcategory?.name?.toLowerCase().includes(s)) return false
    }
    if (filterSale && e.sale_type !== filterSale) return false
    if (filterStatus && e.status !== filterStatus) return false
    if (filterRegion && e.region_id !== filterRegion) return false
    if (filterUrgency) {
      const u = getServiceUrgency(e.next_service_date)
      if (filterUrgency !== u) return false
    }
    return true
  }), [enriched, search, filterSale, filterStatus, filterRegion, filterUrgency])

  const hasFilters = !!(search || filterSale || filterStatus || filterRegion || filterUrgency)
  const clearFilters = () => { setSearch(''); setFilterSale(''); setFilterStatus(''); setFilterRegion(''); setFilterUrgency('') }

  // Bulk helpers
  const toggleBulk = (id: string) =>
    setBulkSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAllFiltered = () => setBulkSelected(new Set(filtered.map(e => e.id)))
  const clearBulk = () => { setBulkSelected(new Set()); setBulkMode(false); setBulkAction(''); setBulkValue('') }

  const executeBulkAction = async () => {
    if (!bulkSelected.size || !bulkAction) return
    setBulkLoading(true)
    try {
      const ids = [...bulkSelected]
      let updatePayload: Record<string, any> = {}
      if (bulkAction === 'set_status')   updatePayload = { status: bulkValue }
      if (bulkAction === 'set_region')   updatePayload = { region_id: bulkValue || null }
      if (bulkAction === 'set_interval') updatePayload = { service_interval_days: Number(bulkValue) }
      if (!Object.keys(updatePayload).length) return

      const { error } = await supabase.from('equipment').update(updatePayload).in('id', ids)
      if (error) throw error
      toast.success(`Updated ${ids.length} equipment records`)
      qc.invalidateQueries({ queryKey: ['equipment-list'] })
      clearBulk()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setBulkLoading(false)
    }
  }

  if (error) {
    return (
      <EmptyState icon={<AlertTriangle size={28} />} title="Failed to load equipment"
        description={String(error)}
        action={<button onClick={() => window.location.reload()} className="btn-secondary text-sm">Retry</button>} />
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Equipment</h1>
          <p className="text-slate-500 text-sm">
            {isLoading ? 'Loading…' : `${filtered.length} of ${equipment.length} items`}
          </p>
        </div>
        {profile?.role === 'admin' && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => navigate('/equipment/qr-labels')} className="btn-secondary text-sm"><QrCode size={15} /> Print QR Stickers</button>
            <button onClick={() => navigate('/equipment/duplicates')} className="btn-secondary text-sm"><ScanLine size={15} /> Scan Duplicates</button>
            <button onClick={() => navigate('/equipment/import')} className="btn-secondary text-sm"><Upload size={15} /> Import Excel</button>
            <button onClick={() => navigate('/equipment/add')} className="btn-primary text-sm"><Plus size={15} /> Add Equipment</button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search facility, serial no, model…"
            className="input-field pl-9 text-sm h-9" />
        </div>
        <button onClick={() => setShowFilters(f => !f)}
          className={`btn-secondary text-sm h-9 ${showFilters ? 'border-biocare-purple-500 text-biocare-purple-400' : ''}`}>
          <Filter size={15} /> Filters {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-biocare-purple-500" />}
        </button>
        {hasFilters && (
          <button onClick={clearFilters} className="btn-secondary text-sm h-9 text-red-400"><X size={15} /> Clear</button>
        )}
      </div>

      {showFilters && (
        <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="label text-xs">Sale Type</label>
            <select value={filterSale} onChange={e => setFilterSale(e.target.value as any)} className="input-field text-sm h-9">
              <option value="">All Types</option>
              <option value="cash">Cash Sale</option>
              <option value="placement">Placement</option>
              <option value="hire_purchase">Hire Purchase</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="input-field text-sm h-9">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="decommissioned">Decommissioned</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Region</label>
            <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} className="input-field text-sm h-9">
              <option value="">All Regions</option>
              {regions.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Service Status</label>
            <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)} className="input-field text-sm h-9">
              <option value="">All</option>
              <option value="overdue">Overdue</option>
              <option value="due_soon">Due Soon (7 days)</option>
              <option value="ok">Up to Date</option>
            </select>
          </div>
        </div>
      )}

      {/* Legend + bulk toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
          {[['bg-emerald-400', 'Cash Sale'], ['bg-orange-400', 'Placement'], ['bg-blue-400', 'Hire Purchase']].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${c}`} />{l}</span>
          ))}
        </div>
        {profile?.role === 'admin' && (
          <button
            onClick={() => { setBulkMode(m => !m); clearBulk() }}
            className={`btn-secondary text-xs h-8 px-3 flex items-center gap-1.5 ${bulkMode ? 'border-biocare-purple-500 text-biocare-purple-400' : ''}`}
          >
            <Layers size={13} /> {bulkMode ? 'Exit Bulk Edit' : 'Bulk Edit'}
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {bulkMode && bulkSelected.size > 0 && (
        <div className="card p-3 flex items-center gap-3 flex-wrap border-biocare-purple-500/40 bg-biocare-purple-500/5">
          <span className="text-sm font-semibold text-biocare-purple-300">{bulkSelected.size} selected</span>
          <select value={bulkAction} onChange={e => { setBulkAction(e.target.value); setBulkValue('') }}
            className="input-field text-sm h-9 w-auto min-w-[180px]">
            <option value="">— Choose action —</option>
            <option value="set_status">Change Status</option>
            <option value="set_region">Change Region</option>
            <option value="set_interval">Change Service Interval (days)</option>
          </select>
          {bulkAction === 'set_status' && (
            <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} className="input-field text-sm h-9 w-auto">
              <option value="">Select status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="decommissioned">Decommissioned</option>
            </select>
          )}
          {bulkAction === 'set_region' && (
            <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} className="input-field text-sm h-9 w-auto">
              <option value="">— No region —</option>
              {regions.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          {bulkAction === 'set_interval' && (
            <input type="number" value={bulkValue} onChange={e => setBulkValue(e.target.value)}
              placeholder="e.g. 90" className="input-field text-sm h-9 w-24" min={1} />
          )}
          <button
            onClick={executeBulkAction}
            disabled={!bulkAction || !bulkValue || bulkLoading}
            className="btn-primary text-sm h-9"
          >
            {bulkLoading ? 'Updating…' : `Apply to ${bulkSelected.size}`}
          </button>
          <button onClick={() => setBulkSelected(new Set())} className="btn-secondary text-xs h-9 px-3">Clear</button>
          <button onClick={selectAllFiltered} className="btn-secondary text-xs h-9 px-3">Select All ({filtered.length})</button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-800 rounded w-1/2 mb-4" />
              <div className="h-3 bg-slate-800 rounded w-full mb-1" />
              <div className="h-3 bg-slate-800 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : !filtered.length ? (
        <EmptyState icon={<Package size={28} />} title="No equipment found"
          description={hasFilters ? "Try adjusting your filters." : "No equipment has been added yet."}
          action={profile?.role === 'admin' ? (
            <button onClick={() => navigate('/equipment/add')} className="btn-primary text-sm"><Plus size={15} /> Add Equipment</button>
          ) : undefined} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(e => (
            <div key={e.id} className="relative">
              {/* Bulk checkbox overlay */}
              {bulkMode && (
                <button
                  onClick={ev => { ev.stopPropagation(); toggleBulk(e.id) }}
                  className={`absolute top-2 left-2 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors shadow-lg ${
                    bulkSelected.has(e.id)
                      ? 'bg-biocare-purple-500 border-biocare-purple-500'
                      : 'bg-slate-900/80 border-slate-500 hover:border-biocare-purple-400'
                  }`}
                >
                  {bulkSelected.has(e.id) && (
                    <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="2,6 5,9 10,3" />
                    </svg>
                  )}
                </button>
              )}
              <EquipmentCard
                equipment={e}
                onClick={() => bulkMode ? toggleBulk(e.id) : navigate(`/equipment/${e.id}`)}
                dimmed={bulkMode && !bulkSelected.has(e.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EquipmentCard({ equipment: e, onClick, dimmed }: { equipment: any; onClick: () => void; dimmed?: boolean }) {
  const days = getDaysUntilService(e.next_service_date)
  const urgency = getServiceUrgency(e.next_service_date)
  const borderColor = e.sale_type === 'cash' ? 'border-l-emerald-500' : e.sale_type === 'placement' ? 'border-l-orange-500' : 'border-l-blue-500'

  const urgencyBadge = urgency === 'overdue'
    ? <span className="badge bg-red-500/20 text-red-400 border border-red-500/30 text-xs"><AlertTriangle size={10} /> {Math.abs(days)}d overdue</span>
    : urgency === 'due_soon'
      ? <span className="badge bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs"><Clock size={10} /> {days}d left</span>
      : e.next_service_date
        ? <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs"><CheckCircle size={10} /> {days}d left</span>
        : <span className="badge bg-slate-700/50 text-slate-500 text-xs">No date set</span>

  return (
    <div onClick={onClick} className={`card card-hover cursor-pointer p-4 border-l-4 ${borderColor} ${dimmed ? 'opacity-40' : ''} transition-opacity`}>
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-200 truncate">{e.facility_name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{e.subcategory?.name ?? '—'} • {e.region?.name ?? '—'}</p>
        </div>
        <ChevronRight size={15} className="text-slate-600 flex-shrink-0 ml-2 mt-0.5" />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-2">
        <SaleTypeBadge saleType={e.sale_type} />
        <StatusBadge status={e.status} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-500 mb-3">
        <span>S/N: <span className="text-slate-300 font-mono">{e.serial_number}</span></span>
        <span>Next: {formatDate(e.next_service_date)}</span>
      </div>

      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
        {urgencyBadge}
        {e.sale_type === 'hire_purchase' && e.hp_payment_status && (
          <span className={`badge text-xs ${e.hp_payment_status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
            HP: {e.hp_payment_status}
          </span>
        )}
      </div>
    </div>
  )
}
