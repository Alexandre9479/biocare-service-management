import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Wrench, ChevronDown, ChevronUp, Image, AlertTriangle, FileDown } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/components/ui/EmptyState'
import SaleTypeBadge from '@/components/equipment/SaleTypeBadge'
import { formatDate, formatCurrency, getServiceTypeLabel } from '@/utils/helpers'
import { generateServiceReport } from '@/utils/pdfReport'
import toast from 'react-hot-toast'

export default function ServiceHistory() {
  const { equipmentId } = useParams()
  const { profile } = useAuth()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterEngineer, setFilterEngineer] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)

  const { data: logs = [], isLoading, error } = useQuery({
    queryKey: ['service-history', equipmentId, profile?.id],
    queryFn: async () => {
      let q = supabase
        .from('service_logs')
        .select('id, equipment_id, engineer_id, service_date, service_type, findings, actions_taken, service_duration_hours, next_recommended_date, total_charge, service_charge, parts_charge, charge_status, payment_status, client_feedback, client_name')
        .order('service_date', { ascending: false })
        .limit(100)

      if (equipmentId) q = q.eq('equipment_id', equipmentId)
      if (profile?.role === 'engineer') q = q.eq('engineer_id', profile.id)

      const { data, error } = await q
      if (error) throw error
      if (!data?.length) return []

      const equipIds = [...new Set(data.map(l => l.equipment_id).filter(Boolean))]
      const engIds   = [...new Set(data.map(l => l.engineer_id).filter(Boolean))]

      const [{ data: equips }, { data: engs }] = await Promise.all([
        equipIds.length ? supabase.from('equipment').select('id, serial_number, facility_name, sale_type, subcategory_id, category_id, region_id, facility_contact_name, facility_contact_phone, facility_address').in('id', equipIds) : { data: [] },
        engIds.length   ? supabase.from('profiles').select('id, name, phone, email').in('id', engIds) : { data: [] },
      ])

      const subIds = [...new Set((equips ?? []).map((e: any) => e.subcategory_id).filter(Boolean))]
      const catIds = [...new Set((equips ?? []).map((e: any) => e.category_id).filter(Boolean))]
      const regIds = [...new Set((equips ?? []).map((e: any) => e.region_id).filter(Boolean))]

      const [{ data: subs }, { data: cats }, { data: regions }] = await Promise.all([
        subIds.length ? supabase.from('subcategories').select('id, name').in('id', subIds) : { data: [] },
        catIds.length ? supabase.from('categories').select('id, name').in('id', catIds) : { data: [] },
        regIds.length ? supabase.from('regions').select('id, name').in('id', regIds) : { data: [] },
      ])

      const logIds = data.map(l => l.id)
      const [{ data: parts }, { data: images }] = await Promise.all([
        supabase.from('service_parts').select('*').in('service_log_id', logIds),
        supabase.from('service_images').select('*').in('service_log_id', logIds),
      ])

      return data.map(l => {
        const eq = equips?.find((e: any) => e.id === l.equipment_id)
        return {
          ...l,
          equipment: eq ? {
            ...eq,
            subcategory: subs?.find((s: any) => s.id === eq.subcategory_id),
            category: cats?.find((c: any) => c.id === eq.category_id),
            region: regions?.find((r: any) => r.id === eq.region_id),
          } : null,
          engineer: engs?.find((e: any) => e.id === l.engineer_id),
          parts: (parts ?? []).filter(p => p.service_log_id === l.id),
          images: (images ?? []).filter(i => i.service_log_id === l.id),
        }
      })
    },
    retry: 2,
  })

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers-filter'],
    queryFn: async () => {
      if (profile?.role !== 'admin') return []
      const { data } = await supabase.from('profiles').select('id, name').eq('role', 'engineer').order('name')
      return data ?? []
    },
    enabled: profile?.role === 'admin',
  })

  const handleDownloadPdf = async (log: any) => {
    if (!log.equipment) { toast.error('Equipment details not loaded'); return }
    setGeneratingPdf(log.id)
    try {
      await generateServiceReport({
        equipment: log.equipment,
        log,
        engineer: log.engineer ?? { name: 'Unknown' },
        parts: log.parts ?? [],
        images: log.images ?? [],
      })
      toast.success('Report downloaded!')
    } catch (err: any) {
      toast.error('Failed to generate PDF: ' + (err?.message ?? 'Unknown error'))
    } finally {
      setGeneratingPdf(null)
    }
  }

  const filtered = logs.filter((l: any) => {
    if (filterEngineer && l.engineer?.id !== filterEngineer) return false
    if (filterMonth && !l.service_date?.startsWith(filterMonth)) return false
    return true
  })

  const totalRevenue = filtered.reduce((s: number, l: any) => s + (l.total_charge ?? 0), 0)
  const freeCount    = filtered.filter((l: any) => !l.total_charge || l.total_charge === 0).length

  if (error) return (
    <EmptyState icon={<AlertTriangle size={28} />} title="Failed to load service history" description={String(error)} />
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title">Service History</h1>
        <p className="text-slate-500 text-sm">{isLoading ? 'Loading…' : `${filtered.length} records`}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Services', value: isLoading ? '…' : filtered.length, color: 'text-slate-100' },
          { label: 'Total Revenue', value: isLoading ? '…' : formatCurrency(totalRevenue), color: 'text-emerald-400' },
          { label: 'Free Services', value: isLoading ? '…' : freeCount, color: 'text-orange-400' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      {profile?.role === 'admin' && (
        <div className="card p-4 flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className="label text-xs">Filter by Engineer</label>
            <select value={filterEngineer} onChange={e => setFilterEngineer(e.target.value)} className="input-field text-sm h-9">
              <option value="">All Engineers</option>
              {engineers.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="label text-xs">Filter by Month</label>
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="input-field text-sm h-9" />
          </div>
        </div>
      )}

      {/* Log list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : !filtered.length ? (
        <EmptyState icon={<Wrench size={28} />} title="No service records"
          description="Service logs will appear here after engineers complete visits." />
      ) : (
        <div className="space-y-3">
          {filtered.map((log: any) => {
            const isExpanded = expandedId === log.id
            const isPdfLoading = generatingPdf === log.id
            return (
              <div key={log.id} className="card overflow-hidden">
                {/* Row header */}
                <div
                  className="px-5 py-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-slate-200">{log.equipment?.facility_name ?? 'Unknown'}</span>
                      {log.equipment?.sale_type && <SaleTypeBadge saleType={log.equipment.sale_type} />}
                    </div>
                    <p className="text-xs text-slate-400">{log.equipment?.subcategory?.name} • {log.equipment?.serial_number}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-slate-500">{formatDate(log.service_date)}</span>
                      {log.service_type && (
                        <span className="badge bg-slate-700/50 text-slate-400 border border-slate-700 text-xs">
                          {getServiceTypeLabel(log.service_type)}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">By: {log.engineer?.name ?? '—'}</span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-1.5">
                    {log.total_charge > 0
                      ? <span className="text-sm font-bold text-emerald-400">{formatCurrency(log.total_charge)}</span>
                      : <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Free</span>}
                    <span className={`badge text-xs ${
                      log.payment_status === 'paid'   ? 'bg-emerald-500/20 text-emerald-400' :
                      log.payment_status === 'waived' ? 'bg-slate-500/20 text-slate-400' :
                                                        'bg-orange-500/20 text-orange-400'}`}>
                      {log.payment_status}
                    </span>
                    {/* PDF download button — stops the row expand/collapse */}
                    <button
                      onClick={e => { e.stopPropagation(); handleDownloadPdf(log) }}
                      disabled={isPdfLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-biocare-purple-500/20 text-biocare-purple-400 border border-biocare-purple-500/30 hover:bg-biocare-purple-500/30 transition-colors disabled:opacity-50"
                      title="Download PDF service report"
                    >
                      {isPdfLoading
                        ? <span className="w-3 h-3 border-2 border-biocare-purple-400 border-t-transparent rounded-full animate-spin" />
                        : <FileDown size={12} />}
                      {isPdfLoading ? 'Generating…' : 'PDF Report'}
                    </button>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-slate-800 px-5 py-4 space-y-4">
                    {log.charge_status && (
                      <p className="text-xs text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2">{log.charge_status}</p>
                    )}
                    {log.findings && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1">Findings</p>
                        <p className="text-sm text-slate-300">{log.findings}</p>
                      </div>
                    )}
                    {log.actions_taken && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1">Actions Taken</p>
                        <p className="text-sm text-slate-300">{log.actions_taken}</p>
                      </div>
                    )}
                    {log.parts?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-2">Parts Used</p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-500">
                              <th className="text-left pb-1">Part</th>
                              <th className="text-left pb-1">Qty</th>
                              <th className="text-right pb-1">Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {log.parts.map((p: any) => (
                              <tr key={p.id} className="border-t border-slate-800/50">
                                <td className="py-1 text-slate-300">{p.part_name}</td>
                                <td className="py-1 text-slate-400">{p.quantity}</td>
                                <td className="py-1 text-right text-slate-300">{formatCurrency(p.total_cost)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {log.images?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1">
                          <Image size={12} /> Photos ({log.images.length})
                        </p>
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                          {log.images.map((img: any) => (
                            <a key={img.id} href={img.image_url} target="_blank" rel="noopener noreferrer"
                              className="rounded-lg overflow-hidden border border-slate-700 aspect-square block relative group">
                              <img src={img.image_url} alt={img.caption || ''} className="w-full h-full object-cover" />
                              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5 capitalize opacity-0 group-hover:opacity-100 transition-opacity">
                                {img.image_type}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {log.client_feedback && (
                      <div>
                        <p className="text-xs font-medium text-slate-400 mb-1">Client Feedback</p>
                        <p className="text-sm text-slate-300 italic">"{log.client_feedback}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
