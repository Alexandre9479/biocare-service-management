import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ScanLine, AlertTriangle, Trash2, ExternalLink, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import supabase from '@/lib/supabase'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import SaleTypeBadge from '@/components/equipment/SaleTypeBadge'
import StatusBadge from '@/components/equipment/StatusBadge'
import { formatDate } from '@/utils/helpers'
import toast from 'react-hot-toast'

type DupGroup = {
  key: string
  type: 'serial' | 'facility_model' | 'facility_only'
  label: string
  items: any[]
}

export default function DuplicateScanner() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [filter, setFilter] = useState<'all' | 'serial' | 'facility_model'>('all')

  const { data: equipment = [], isLoading, refetch } = useQuery({
    queryKey: ['equipment-for-duplicates'],
    queryFn: async () => {
      // Fetch all equipment with related names
      const { data, error } = await supabase
        .from('equipment')
        .select('id, serial_number, facility_name, sale_type, status, next_service_date, installation_date, subcategory_id, region_id, created_at')
        .order('facility_name')
      if (error) throw error

      const subIds = [...new Set((data ?? []).map(e => e.subcategory_id).filter(Boolean))]
      const regIds = [...new Set((data ?? []).map(e => e.region_id).filter(Boolean))]

      const [{ data: subs }, { data: regions }] = await Promise.all([
        subIds.length ? supabase.from('subcategories').select('id, name').in('id', subIds) : { data: [] },
        regIds.length ? supabase.from('regions').select('id, name').in('id', regIds) : { data: [] },
      ])

      return (data ?? []).map(e => ({
        ...e,
        subcategory: subs?.find((s: any) => s.id === e.subcategory_id),
        region: regions?.find((r: any) => r.id === e.region_id),
      }))
    },
    retry: 2,
  })

  // ── Duplicate detection ──────────────────────────────────────────────────
  const duplicateGroups = useMemo((): DupGroup[] => {
    const groups: DupGroup[] = []

    // 1. Exact serial number duplicates (most critical)
    const bySerial: Record<string, any[]> = {}
    equipment.forEach(e => {
      const key = (e.serial_number ?? '').trim().toUpperCase()
      if (!key) return
      if (!bySerial[key]) bySerial[key] = []
      bySerial[key].push(e)
    })
    Object.entries(bySerial).forEach(([sn, items]) => {
      if (items.length > 1) {
        groups.push({ key: `serial:${sn}`, type: 'serial', label: `Serial: ${sn}`, items })
      }
    })

    // 2. Same facility + same equipment model (potential duplicates)
    const byFacilityModel: Record<string, any[]> = {}
    equipment.forEach(e => {
      const fac = e.facility_name?.trim().toUpperCase() ?? ''
      const mod = (e.subcategory?.name ?? e.subcategory_id ?? '').toString().trim().toUpperCase()
      if (!fac || !mod) return
      const key = `${fac}||${mod}`
      if (!byFacilityModel[key]) byFacilityModel[key] = []
      byFacilityModel[key].push(e)
    })
    Object.entries(byFacilityModel).forEach(([key, items]) => {
      if (items.length > 1) {
        const [fac, mod] = key.split('||')
        // Don't double-report if all are already caught by serial dup
        const allCaughtBySerial = items.every(item =>
          groups.some(g => g.type === 'serial' && g.items.some(i => i.id === item.id))
        )
        if (!allCaughtBySerial) {
          groups.push({ key: `fm:${key}`, type: 'facility_model', label: `${items[0].facility_name} — ${items[0].subcategory?.name ?? 'Unknown model'}`, items })
        }
      }
    })

    return groups.sort((a, b) => {
      // Serial dups first, then by group size descending
      if (a.type === 'serial' && b.type !== 'serial') return -1
      if (a.type !== 'serial' && b.type === 'serial') return 1
      return b.items.length - a.items.length
    })
  }, [equipment])

  const shown = filter === 'all' ? duplicateGroups
    : duplicateGroups.filter(g => g.type === filter)

  const toggle = (key: string) => setExpanded(s => {
    const n = new Set(s)
    n.has(key) ? n.delete(key) : n.add(key)
    return n
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('equipment').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Equipment deleted')
      qc.invalidateQueries({ queryKey: ['equipment-for-duplicates'] })
      qc.invalidateQueries({ queryKey: ['equipment-list'] })
      setDeleteTarget(null)
    },
    onError: (e: any) => toast.error(e.message),
  })

  if (isLoading) return <PageSpinner />

  const serialCount = duplicateGroups.filter(g => g.type === 'serial').length
  const modelCount = duplicateGroups.filter(g => g.type === 'facility_model').length
  const totalAffected = duplicateGroups.reduce((s, g) => s + g.items.length, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ScanLine size={24} className="text-biocare-cyan-400" /> Duplicate Scanner
          </h1>
          <p className="text-slate-500 text-sm">Scanned {equipment.length} equipment records</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary text-sm">
          <ScanLine size={14} /> Re-scan
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className={`text-3xl font-bold ${serialCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{serialCount}</p>
          <p className="text-xs text-slate-500 mt-1">Serial Number Duplicates</p>
          <p className="text-xs text-red-400/70 mt-0.5">{serialCount > 0 ? 'Action required' : 'All clear'}</p>
        </div>
        <div className="card p-4 text-center">
          <p className={`text-3xl font-bold ${modelCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{modelCount}</p>
          <p className="text-xs text-slate-500 mt-1">Facility+Model Duplicates</p>
          <p className="text-xs text-amber-400/70 mt-0.5">{modelCount > 0 ? 'Review needed' : 'All clear'}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-slate-200">{totalAffected}</p>
          <p className="text-xs text-slate-500 mt-1">Total Affected Records</p>
        </div>
      </div>

      {duplicateGroups.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={36} className="text-emerald-400" />}
          title="No duplicates found!"
          description={`All ${equipment.length} equipment records are unique.`}
        />
      ) : (
        <>
          {/* Filter tabs */}
          <div className="flex gap-1 bg-slate-900 rounded-xl p-1 w-fit">
            {([
              { key: 'all', label: `All (${duplicateGroups.length})` },
              { key: 'serial', label: `Serial (${serialCount})` },
              { key: 'facility_model', label: `Facility+Model (${modelCount})` },
            ] as { key: typeof filter, label: string }[]).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${filter === f.key ? 'bg-biocare-purple-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Duplicate groups */}
          <div className="space-y-3">
            {shown.map(group => {
              const isOpen = expanded.has(group.key)
              return (
                <div key={group.key} className={`card overflow-hidden border-l-4 ${group.type === 'serial' ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                  {/* Group header */}
                  <div
                    className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors"
                    onClick={() => toggle(group.key)}>
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={16} className={group.type === 'serial' ? 'text-red-400' : 'text-amber-400'} />
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{group.label}</p>
                        <p className="text-xs text-slate-500">
                          {group.items.length} records •{' '}
                          {group.type === 'serial'
                            ? 'Exact serial number match — likely a data entry error'
                            : 'Same facility and equipment model — review if intentional'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge text-xs ${group.type === 'serial' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                        {group.type === 'serial' ? 'Serial dup' : 'Facility+Model dup'}
                      </span>
                      {isOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                    </div>
                  </div>

                  {/* Group items */}
                  {isOpen && (
                    <div className="border-t border-slate-800 divide-y divide-slate-800">
                      {group.items.map((item, idx) => (
                        <div key={item.id} className="px-5 py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs text-slate-500">#{idx + 1}</span>
                              <span className="text-sm font-medium text-slate-200">{item.facility_name}</span>
                              <SaleTypeBadge saleType={item.sale_type} />
                              <StatusBadge status={item.status} />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-slate-500">
                              <span>S/N: <span className="text-slate-300 font-mono">{item.serial_number ?? '—'}</span></span>
                              <span>Model: {item.subcategory?.name ?? '—'}</span>
                              <span>Region: {item.region?.name ?? '—'}</span>
                              <span>Installed: {formatDate(item.installation_date)}</span>
                              <span>Added: {formatDate(item.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => navigate(`/equipment/${item.id}`)}
                              className="p-1.5 text-slate-500 hover:text-biocare-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                              title="View equipment">
                              <ExternalLink size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Delete this record">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Equipment Record">
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-xl p-4 text-sm">
            <p className="font-medium text-slate-200">{deleteTarget?.facility_name}</p>
            <p className="text-slate-400 text-xs mt-1">S/N: {deleteTarget?.serial_number} • {deleteTarget?.subcategory?.name}</p>
          </div>
          <p className="text-slate-400 text-sm">
            This will permanently delete this equipment record and all its service logs. This cannot be undone.
          </p>
          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Make sure you are deleting the <strong>duplicate</strong> entry, not the original.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Cancel</button>
            <button
              onClick={() => deleteMutation.mutate(deleteTarget?.id)}
              disabled={deleteMutation.isPending}
              className="btn-danger">
              {deleteMutation.isPending ? 'Deleting…' : 'Delete This Record'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
