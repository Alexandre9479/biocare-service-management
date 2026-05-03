import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit2, Wrench, Phone, Mail, MapPin, Calendar, AlertTriangle, Package, Trash2, QrCode } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import SaleTypeBadge from '@/components/equipment/SaleTypeBadge'
import StatusBadge from '@/components/equipment/StatusBadge'
import { PageSpinner } from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import { formatDate, formatCurrency, getDaysUntilService, calculateHPProgress, getServiceTypeLabel } from '@/utils/helpers'
import toast from 'react-hot-toast'

export default function EquipmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [showDelete, setShowDelete] = useState(false)

  const { data: equipment, isLoading, error } = useQuery({
    queryKey: ['equipment-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error

      // Fetch related names separately
      const [catRes, subRes, regRes] = await Promise.all([
        data.category_id ? supabase.from('categories').select('name').eq('id', data.category_id).single() : { data: null },
        data.subcategory_id ? supabase.from('subcategories').select('name').eq('id', data.subcategory_id).single() : { data: null },
        data.region_id ? supabase.from('regions').select('name').eq('id', data.region_id).single() : { data: null },
      ])

      return {
        ...data,
        category: catRes.data,
        subcategory: subRes.data,
        region: regRes.data,
      }
    },
    enabled: !!id,
    retry: 2,
  })

  const { data: serviceLogs = [] } = useQuery({
    queryKey: ['service-logs-equipment', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_logs')
        .select('id, service_date, service_type, findings, total_charge, charge_status, payment_status, engineer_id')
        .eq('equipment_id', id!)
        .order('service_date', { ascending: false })
        .limit(20)
      if (error) throw error

      const engIds = [...new Set((data ?? []).map(l => l.engineer_id).filter(Boolean))]
      const { data: engs } = engIds.length
        ? await supabase.from('profiles').select('id, name').in('id', engIds)
        : { data: [] }

      return (data ?? []).map(l => ({ ...l, engineer: engs?.find(e => e.id === l.engineer_id) }))
    },
    enabled: !!id,
    retry: 2,
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('equipment').delete().eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Equipment deleted')
      qc.invalidateQueries({ queryKey: ['equipment-list'] })
      navigate('/equipment')
    },
    onError: (e: any) => toast.error(e.message),
  })

  if (isLoading) return <PageSpinner />
  if (error || !equipment) return (
    <div className="text-center py-20">
      <p className="text-slate-400">Equipment not found.</p>
      <button onClick={() => navigate('/equipment')} className="btn-secondary text-sm mt-4">Back to Equipment</button>
    </div>
  )

  const days = getDaysUntilService(equipment.next_service_date)
  const hpProgress = calculateHPProgress(equipment)

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-secondary h-9 w-9 p-0 justify-center"><ArrowLeft size={16} /></button>
          <div>
            <h1 className="page-title">{equipment.facility_name}</h1>
            <p className="text-slate-500 text-sm font-mono">S/N: {equipment.serial_number}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => navigate(`/equipment/qr-labels/${id}`)}
            className="btn-secondary text-sm"
            title="Print QR sticker for this machine">
            <QrCode size={14} /> Print QR Sticker
          </button>
          {profile?.role === 'admin' && (
            <>
              <button onClick={() => setShowDelete(true)} className="btn-secondary text-sm text-red-400"><Trash2 size={14} /> Delete</button>
              <button onClick={() => navigate(`/equipment/${id}/edit`)} className="btn-primary text-sm"><Edit2 size={14} /> Edit</button>
            </>
          )}
        </div>
      </div>

      {/* Status strip */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <SaleTypeBadge saleType={equipment.sale_type} />
        <StatusBadge status={equipment.status} />
        <span className={`badge ${days < 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : days <= 7 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
          {days < 0 ? <><AlertTriangle size={11} className="inline mr-1" />{Math.abs(days)}d overdue</> : `${days}d to service`}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Details */}
          <div className="card p-5">
            <h3 className="section-title mb-4">Equipment Details</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ['Category', equipment.category?.name],
                ['Model', equipment.subcategory?.name],
                ['Region', equipment.region?.name],
                ['County', equipment.county],
                ['Installed', formatDate(equipment.installation_date)],
                ['Interval', equipment.service_interval_days ? `Every ${equipment.service_interval_days} days` : null],
                ['Last Service', formatDate(equipment.last_service_date)],
                ['Next Service', formatDate(equipment.next_service_date)],
                ['Warranty Expiry', formatDate(equipment.warranty_expiry_date)],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-sm text-slate-200 mt-0.5">{value || '—'}</dd>
                </div>
              ))}
            </dl>
            {equipment.notes && (
              <div className="mt-4 pt-4 border-t border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Notes</p>
                <p className="text-sm text-slate-300">{equipment.notes}</p>
              </div>
            )}
          </div>

          {/* HP Details */}
          {equipment.sale_type === 'hire_purchase' && (
            <div className="card p-5">
              <h3 className="section-title mb-4">Hire Purchase Details</h3>
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Payment Progress</span>
                  <span>{equipment.hp_installments_paid ?? 0} / {equipment.hp_total_installments ?? '?'} installments</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-biocare-cyan-500 rounded-full transition-all" style={{ width: `${hpProgress}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-1">{hpProgress}% paid</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ['Total Price', formatCurrency(equipment.hp_total_price)],
                  ['Down Payment', formatCurrency(equipment.hp_down_payment)],
                  ['Installment', formatCurrency(equipment.hp_installment_amount)],
                  ['Frequency', equipment.hp_installment_frequency],
                  ['Status', equipment.hp_payment_status],
                  ['Final Payment', formatDate(equipment.hp_final_payment_date)],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="text-sm text-slate-200 mt-0.5 capitalize">{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Service History */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h3 className="section-title">Service History ({serviceLogs.length})</h3>
              <button onClick={() => navigate(`/service/log-new/${id}`)} className="btn-primary text-xs py-1.5 px-3">
                <Wrench size={13} /> Log Service
              </button>
            </div>
            {!serviceLogs.length ? (
              <p className="text-center py-8 text-slate-500 text-sm">No service records yet</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {serviceLogs.map((log: any) => (
                  <div key={log.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">{formatDate(log.service_date)}</span>
                          {log.service_type && (
                            <span className="badge bg-slate-700/50 text-slate-400 border border-slate-700 text-xs">{getServiceTypeLabel(log.service_type)}</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">By: {log.engineer?.name ?? '—'}</p>
                        {log.charge_status && <p className="text-xs text-slate-600 mt-0.5">{log.charge_status}</p>}
                      </div>
                      <div className="text-right">
                        {log.total_charge > 0
                          ? <span className="text-sm font-semibold text-emerald-400">{formatCurrency(log.total_charge)}</span>
                          : <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Free</span>}
                        <p className="text-xs text-slate-600 mt-0.5 capitalize">{log.payment_status}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="section-title mb-4">Facility Contact</h3>
            <div className="space-y-2.5">
              {equipment.facility_contact_name && (
                <div className="flex items-center gap-2 text-sm text-slate-300"><Package size={14} className="text-slate-500" />{equipment.facility_contact_name}</div>
              )}
              {equipment.facility_contact_phone && (
                <a href={`tel:${equipment.facility_contact_phone}`} className="flex items-center gap-2 text-sm text-biocare-cyan-400 hover:text-biocare-cyan-300">
                  <Phone size={14} />{equipment.facility_contact_phone}
                </a>
              )}
              {equipment.facility_contact_email && (
                <a href={`mailto:${equipment.facility_contact_email}`} className="flex items-center gap-2 text-sm text-biocare-cyan-400 hover:text-biocare-cyan-300 break-all">
                  <Mail size={14} />{equipment.facility_contact_email}
                </a>
              )}
              {equipment.facility_address && (
                <div className="flex items-start gap-2 text-sm text-slate-400"><MapPin size={14} className="text-slate-500 mt-0.5" />{equipment.facility_address}</div>
              )}
              {!equipment.facility_contact_name && !equipment.facility_contact_phone && !equipment.facility_contact_email && (
                <p className="text-sm text-slate-600">No contact info on file</p>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="section-title mb-3">Service Billing</h3>
            {equipment.sale_type === 'cash' && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-xs font-semibold text-emerald-400">Chargeable Service</p>
                <p className="text-xs text-emerald-400/70 mt-0.5">Customer pays all fees.</p>
              </div>
            )}
            {equipment.sale_type === 'placement' && (
              <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <p className="text-xs font-semibold text-orange-400">Free Service (Placement)</p>
                <p className="text-xs text-orange-400/70 mt-0.5">All maintenance covered by Biocare.</p>
              </div>
            )}
            {equipment.sale_type === 'hire_purchase' && (
              <div className={`p-3 rounded-lg border ${equipment.hp_payment_status === 'active' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                <p className={`text-xs font-semibold ${equipment.hp_payment_status === 'active' ? 'text-blue-400' : 'text-amber-400'}`}>
                  {equipment.hp_payment_status === 'active' ? 'Free Service (Under HP)' : 'Chargeable (HP Completed)'}
                </p>
                <p className="text-xs opacity-70 mt-0.5">
                  {equipment.hp_payment_status === 'active' ? `Free until all installments paid.` : 'Payment complete. Service fees apply.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Equipment">
        <p className="text-slate-400 text-sm mb-6">
          Delete <strong className="text-slate-200">{equipment.facility_name}</strong>? All service logs will also be deleted. This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={() => setShowDelete(false)} className="btn-secondary">Cancel</button>
          <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="btn-danger">
            {deleteMutation.isPending ? 'Deleting…' : 'Delete Equipment'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
