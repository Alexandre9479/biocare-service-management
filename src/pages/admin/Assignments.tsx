import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Plus, User, Calendar, CheckCircle, AlertTriangle, Search, MessageCircle } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import SaleTypeBadge from '@/components/equipment/SaleTypeBadge'
import { formatDate, getDaysUntilService, getAvailabilityClasses, getAvailabilityLabel, getServiceTypeLabel } from '@/utils/helpers'
import { notifyEngineerAssignment } from '@/utils/whatsapp'
import toast from 'react-hot-toast'
import type { Priority, ServiceType } from '@/types'

type Tab = 'pending' | 'scheduled' | 'completed'

export default function Assignments() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('pending')

  // ── Create/Assign modal state ────────────────────────────────────────────
  const [assignModal, setAssignModal] = useState<any>(null)   // existing pending assignment
  const [createModal, setCreateModal] = useState(false)        // new job from scratch
  const [engineerId, setEngineerId] = useState('')
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0])
  const [serviceType, setServiceType] = useState<ServiceType>('preventive')
  const [priority, setPriority] = useState<Priority>('medium')
  const [instructions, setInstructions] = useState('')
  // For create-from-scratch
  const [equipSearch, setEquipSearch] = useState('')
  const [selectedEquipId, setSelectedEquipId] = useState('')

  // ── Assignment list ──────────────────────────────────────────────────────
  const { data: assignments = [], isLoading, error } = useQuery({
    queryKey: ['assignments', tab],
    queryFn: async () => {
      const statusMap: Record<Tab, string[]> = {
        pending:   ['pending'],
        scheduled: ['scheduled', 'in_progress'],
        completed: ['completed', 'cancelled'],
      }
      const { data: assigns, error: aErr } = await supabase
        .from('service_assignments')
        .select('id, equipment_id, engineer_id, scheduled_date, service_type, status, priority, special_instructions, created_at')
        .in('status', statusMap[tab])
        .order('created_at', { ascending: true })
        .limit(60)
      if (aErr) throw aErr
      if (!assigns?.length) return []

      const equipIds = [...new Set(assigns.map(a => a.equipment_id).filter(Boolean))]
      const engIds   = [...new Set(assigns.map(a => a.engineer_id).filter(Boolean))]

      const [{ data: equips }, { data: engs }, { data: regions }, { data: subs }] = await Promise.all([
        equipIds.length ? supabase.from('equipment').select('id, serial_number, facility_name, sale_type, next_service_date, region_id, subcategory_id').in('id', equipIds) : { data: [] },
        engIds.length   ? supabase.from('profiles').select('id, name, availability_status').in('id', engIds) : { data: [] },
        supabase.from('regions').select('id, name'),
        supabase.from('subcategories').select('id, name'),
      ])

      return assigns.map(a => {
        const eq = equips?.find((e: any) => e.id === a.equipment_id)
        return {
          ...a,
          equipment: eq ? {
            ...eq,
            region: (regions as any[])?.find?.((r: any) => r.id === eq.region_id),
            subcategory: (subs as any[])?.find?.((s: any) => s.id === eq.subcategory_id),
          } : null,
          engineer: engs?.find((e: any) => e.id === a.engineer_id),
        }
      })
    },
    retry: 2,
  })

  // Equipment due within 7 days with no active assignment
  const { data: dueEquipment = [] } = useQuery({
    queryKey: ['due-unassigned-equipment'],
    queryFn: async () => {
      const threshold = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      const { data: equips } = await supabase
        .from('equipment')
        .select('id, serial_number, facility_name, sale_type, next_service_date, region_id, subcategory_id')
        .lte('next_service_date', threshold)
        .eq('status', 'active')
        .order('next_service_date')
        .limit(40)
      if (!equips?.length) return []

      const { data: active } = await supabase
        .from('service_assignments')
        .select('equipment_id')
        .in('status', ['pending', 'scheduled', 'in_progress'])
        .in('equipment_id', equips.map(e => e.id))

      const assignedIds = new Set((active ?? []).map(a => a.equipment_id))
      const unassigned = equips.filter(e => !assignedIds.has(e.id))

      const regionIds = [...new Set(unassigned.map(e => e.region_id).filter(Boolean))]
      const subIds    = [...new Set(unassigned.map(e => e.subcategory_id).filter(Boolean))]

      const [{ data: regions }, { data: subs }] = await Promise.all([
        regionIds.length ? supabase.from('regions').select('id, name').in('id', regionIds) : { data: [] },
        subIds.length    ? supabase.from('subcategories').select('id, name').in('id', subIds) : { data: [] },
      ])

      return unassigned.map(e => ({
        ...e,
        region: regions?.find((r: any) => r.id === e.region_id),
        subcategory: subs?.find((s: any) => s.id === e.subcategory_id),
      }))
    },
    enabled: tab === 'pending',
    retry: 2,
  })

  // All equipment (for create-from-scratch equipment picker)
  const { data: allEquipment = [] } = useQuery({
    queryKey: ['all-equipment-picker'],
    queryFn: async () => {
      const { data } = await supabase
        .from('equipment')
        .select('id, serial_number, facility_name, sale_type, next_service_date, region_id, subcategory_id')
        .eq('status', 'active')
        .order('facility_name')
        .limit(300)
      return data ?? []
    },
    enabled: createModal,
  })

  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, name, availability_status, specializations').eq('role', 'engineer').order('name')
      return data ?? []
    },
  })

  // ── Mutations ────────────────────────────────────────────────────────────

  // Assign engineer to an existing pending assignment
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignModal || !engineerId) throw new Error('Select an engineer')
      const { error } = await supabase
        .from('service_assignments')
        .update({
          engineer_id: engineerId,
          scheduled_date: scheduledDate,
          service_type: serviceType,
          priority,
          special_instructions: instructions || null,
          status: 'scheduled',
          assigned_by: profile?.id,
          assigned_at: new Date().toISOString(),
        })
        .eq('id', assignModal.id)
      if (error) throw error

      // In-app notification
      await supabase.from('notifications').insert({
        recipient_id: engineerId,
        type: 'assignment',
        title: 'New Service Assignment',
        message: `You have been assigned to service ${assignModal.equipment?.facility_name ?? 'a facility'} on ${formatDate(scheduledDate)}`,
        data: { assignment_id: assignModal.id, equipment_id: assignModal.equipment_id },
        priority: priority === 'urgent' ? 'urgent' : 'medium',
      })

      // WhatsApp notification — fire & forget (don't block on failure)
      const selectedEng = engineers.find((e: any) => e.id === engineerId) as any
      if (selectedEng?.phone) {
        notifyEngineerAssignment({
          engineerPhone: selectedEng.phone,
          engineerName: selectedEng.name,
          facilityName: assignModal.equipment?.facility_name ?? '—',
          equipmentModel: assignModal.equipment?.subcategory?.name ?? '—',
          serialNumber: assignModal.equipment?.serial_number ?? '—',
          scheduledDate: formatDate(scheduledDate),
          serviceType: getServiceTypeLabel(serviceType),
          instructions: instructions || undefined,
          sentBy: profile?.id,
        }).catch(console.error)
      }
    },
    onSuccess: () => {
      toast.success('Engineer assigned!')
      qc.invalidateQueries({ queryKey: ['assignments'] })
      qc.invalidateQueries({ queryKey: ['due-unassigned-equipment'] })
      qc.invalidateQueries({ queryKey: ['pending-assignments-count'] })
      closeModals()
    },
    onError: (e: any) => toast.error(e.message),
  })

  // Create brand-new job (admin picks any equipment)
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEquipId) throw new Error('Select equipment')

      const assignPayload: any = {
        equipment_id: selectedEquipId,
        service_type: serviceType,
        priority,
        special_instructions: instructions || null,
        status: engineerId ? 'scheduled' : 'pending',
        assigned_by: profile?.id,
      }
      if (engineerId) {
        assignPayload.engineer_id = engineerId
        assignPayload.scheduled_date = scheduledDate
        assignPayload.assigned_at = new Date().toISOString()
      }

      const { data: newAssignment, error: aErr } = await supabase
        .from('service_assignments')
        .insert(assignPayload)
        .select()
        .single()
      if (aErr) throw aErr

      if (engineerId && newAssignment) {
        const eq = allEquipment.find((e: any) => e.id === selectedEquipId) as any
        // In-app notification
        await supabase.from('notifications').insert({
          recipient_id: engineerId,
          type: 'assignment',
          title: 'New Service Assignment',
          message: `You have been assigned to service ${eq?.facility_name ?? 'a facility'} on ${formatDate(scheduledDate)}`,
          data: { assignment_id: newAssignment.id, equipment_id: selectedEquipId },
          priority: priority === 'urgent' ? 'urgent' : 'medium',
        })
        // WhatsApp notification — fire & forget
        const selectedEng = engineers.find((e: any) => e.id === engineerId) as any
        if (selectedEng?.phone) {
          notifyEngineerAssignment({
            engineerPhone: selectedEng.phone,
            engineerName: selectedEng.name,
            facilityName: eq?.facility_name ?? '—',
            equipmentModel: eq?.subcategory?.name ?? '—',
            serialNumber: eq?.serial_number ?? '—',
            scheduledDate: formatDate(scheduledDate),
            serviceType: getServiceTypeLabel(serviceType),
            instructions: instructions || undefined,
            sentBy: profile?.id,
          }).catch(console.error)
        }
      }
    },
    onSuccess: () => {
      toast.success(engineerId ? 'Job created and engineer assigned!' : 'Job created — assign an engineer when ready.')
      qc.invalidateQueries({ queryKey: ['assignments'] })
      qc.invalidateQueries({ queryKey: ['due-unassigned-equipment'] })
      qc.invalidateQueries({ queryKey: ['pending-assignments-count'] })
      closeModals()
    },
    onError: (e: any) => toast.error(e.message),
  })

  // Create pending assignment from due-equipment card, then open assign modal
  const createFromDue = async (eq: any) => {
    const { data, error } = await supabase
      .from('service_assignments')
      .insert({ equipment_id: eq.id, status: 'pending', priority: 'medium' })
      .select()
      .single()
    if (error) { toast.error(error.message); return }
    qc.invalidateQueries({ queryKey: ['due-unassigned-equipment'] })
    setAssignModal({ ...data, equipment: eq })
  }

  const closeModals = () => {
    setAssignModal(null)
    setCreateModal(false)
    setEngineerId('')
    setInstructions('')
    setSelectedEquipId('')
    setEquipSearch('')
  }

  const filteredEquip = allEquipment.filter((e: any) => {
    if (!equipSearch) return true
    const s = equipSearch.toLowerCase()
    return e.facility_name?.toLowerCase().includes(s) || e.serial_number?.toLowerCase().includes(s)
  })

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Service Assignments</h1>
          <p className="text-slate-500 text-sm">Create and assign service jobs to engineers</p>
        </div>
        <button onClick={() => setCreateModal(true)} className="btn-primary text-sm">
          <Plus size={15} /> Create Service Job
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 rounded-xl p-1 w-fit">
        {(['pending', 'scheduled', 'completed'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${tab === t ? 'bg-biocare-purple-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="card p-4 border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> Failed to load. {String(error)}
        </div>
      )}

      {/* ── PENDING TAB ── */}
      {tab === 'pending' && (
        <div className="space-y-4">
          {/* Overdue / due-soon unassigned equipment */}
          {dueEquipment.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
                <AlertTriangle size={18} className="text-amber-400" />
                <h2 className="section-title">Overdue / Due Within 7 Days — Unassigned</h2>
                <span className="badge bg-amber-500/20 text-amber-400 border border-amber-500/30">{dueEquipment.length}</span>
              </div>
              <div className="divide-y divide-slate-800">
                {dueEquipment.map((eq: any) => {
                  const days = getDaysUntilService(eq.next_service_date)
                  return (
                    <div key={eq.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-slate-200">{eq.facility_name}</span>
                          <SaleTypeBadge saleType={eq.sale_type} />
                        </div>
                        <p className="text-xs text-slate-400">{eq.subcategory?.name} • S/N: {eq.serial_number}</p>
                        <p className="text-xs text-slate-500">{eq.region?.name} • Due: {formatDate(eq.next_service_date)}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`badge text-xs ${days < 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                          {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                        </span>
                        <button onClick={() => createFromDue(eq)} className="btn-cyan text-xs py-1.5 px-3">
                          <User size={13} /> Assign
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Existing pending (unassigned) assignments */}
          {assignments.length > 0 && (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
                <ClipboardList size={18} className="text-orange-400" />
                <h2 className="section-title">Pending Assignments</h2>
                <span className="badge bg-orange-500/20 text-orange-400 border border-orange-500/30">{assignments.length}</span>
              </div>
              <div className="divide-y divide-slate-800">
                {assignments.map((a: any) => (
                  <AssignmentRow key={a.id} a={a} onAssign={() => setAssignModal(a)} />
                ))}
              </div>
            </div>
          )}

          {!dueEquipment.length && !assignments.length && !isLoading && (
            <EmptyState icon={<CheckCircle size={28} />} title="All caught up!"
              description="No pending service assignments. Create a new service job using the button above." />
          )}
        </div>
      )}

      {/* ── SCHEDULED / COMPLETED TABS ── */}
      {tab !== 'pending' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="section-title capitalize">{tab} Assignments ({isLoading ? '…' : assignments.length})</h2>
          </div>
          {isLoading ? (
            <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-biocare-purple-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : !assignments.length ? (
            <EmptyState icon={<ClipboardList size={28} />} title={`No ${tab} assignments`} />
          ) : (
            <div className="divide-y divide-slate-800">
              {assignments.map((a: any) => <AssignmentRow key={a.id} a={a} />)}
            </div>
          )}
        </div>
      )}

      {/* ── ASSIGN ENGINEER MODAL (for existing pending assignment) ── */}
      <AssignModal
        open={!!assignModal}
        title="Assign Engineer"
        equipment={assignModal?.equipment}
        engineers={engineers}
        engineerId={engineerId} setEngineerId={setEngineerId}
        scheduledDate={scheduledDate} setScheduledDate={setScheduledDate}
        serviceType={serviceType} setServiceType={setServiceType}
        priority={priority} setPriority={setPriority}
        instructions={instructions} setInstructions={setInstructions}
        onClose={closeModals}
        onSubmit={() => assignMutation.mutate()}
        submitting={assignMutation.isPending}
        submitLabel="Assign Engineer"
        requireEngineer
      />

      {/* ── CREATE NEW JOB MODAL ── */}
      <Modal open={createModal} onClose={closeModals} title="Create Service Job" size="xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Equipment selector */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-800 pb-2">1. Select Equipment</h3>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={equipSearch} onChange={e => setEquipSearch(e.target.value)}
                placeholder="Search facility or serial…" className="input-field pl-9 text-sm h-9" />
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {filteredEquip.slice(0, 60).map((eq: any) => (
                <label key={eq.id}
                  className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all text-sm ${selectedEquipId === eq.id ? 'border-biocare-cyan-500 bg-biocare-cyan-500/10' : 'border-slate-700 hover:border-slate-600'}`}>
                  <input type="radio" name="equip" value={eq.id} checked={selectedEquipId === eq.id}
                    onChange={() => setSelectedEquipId(eq.id)} className="sr-only" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-200 truncate">{eq.facility_name}</p>
                    <p className="text-xs text-slate-500 truncate">S/N: {eq.serial_number} • Due: {formatDate(eq.next_service_date)}</p>
                  </div>
                  <SaleTypeBadge saleType={eq.sale_type} />
                </label>
              ))}
              {filteredEquip.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No equipment found</p>
              )}
            </div>
          </div>

          {/* Right: Job details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 border-b border-slate-800 pb-2">2. Job Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Service Date</label>
                <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label">Service Type</label>
                <select value={serviceType} onChange={e => setServiceType(e.target.value as ServiceType)} className="input-field">
                  <option value="preventive">Preventive Maintenance</option>
                  <option value="corrective">Corrective Maintenance</option>
                  <option value="calibration">Calibration</option>
                  <option value="installation">Installation</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className="input-field">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Instructions (optional)</label>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                rows={2} className="input-field resize-none" placeholder="Special notes for the engineer…" />
            </div>

            <div>
              <label className="label">Assign Engineer (optional — can assign later)</label>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                <label className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all text-sm ${engineerId === '' ? 'border-slate-600 bg-slate-800/50' : 'border-slate-700 hover:border-slate-600'}`}>
                  <input type="radio" name="eng" value="" checked={engineerId === ''} onChange={() => setEngineerId('')} className="sr-only" />
                  <span className="text-slate-400 italic">— Assign later —</span>
                </label>
                {engineers.map((eng: any) => (
                  <label key={eng.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${engineerId === eng.id ? 'border-biocare-cyan-500 bg-biocare-cyan-500/10' : 'border-slate-700 hover:border-slate-600'}`}>
                    <input type="radio" name="eng" value={eng.id} checked={engineerId === eng.id} onChange={() => setEngineerId(eng.id)} className="sr-only" />
                    <div className="w-7 h-7 rounded-full bg-biocare-purple-500/20 flex items-center justify-center text-xs font-bold text-biocare-purple-300 flex-shrink-0">
                      {eng.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200">{eng.name}</p>
                      <p className="text-xs text-slate-500">{eng.specializations?.join(', ') || 'General'}</p>
                    </div>
                    <span className={`badge text-xs ${getAvailabilityClasses(eng.availability_status)}`}>
                      {getAvailabilityLabel(eng.availability_status)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-800">
          <button onClick={closeModals} className="btn-secondary">Cancel</button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!selectedEquipId || createMutation.isPending}
            className="btn-primary">
            {createMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating…
              </span>
            ) : engineerId ? 'Create & Assign' : 'Create Job (Assign Later)'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ── Shared row component ─────────────────────────────────────────────────────
function AssignmentRow({ a, onAssign }: { a: any; onAssign?: () => void }) {
  const days = getDaysUntilService(a.equipment?.next_service_date)
  return (
    <div className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-slate-800/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-semibold text-slate-200">{a.equipment?.facility_name ?? '—'}</span>
          {a.equipment?.sale_type && <SaleTypeBadge saleType={a.equipment.sale_type} />}
        </div>
        <p className="text-xs text-slate-400">{a.equipment?.subcategory?.name ?? '—'} • S/N: {a.equipment?.serial_number ?? '—'}</p>
        <p className="text-xs text-slate-500">{a.equipment?.region?.name ?? '—'}</p>
        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-500">
          {a.scheduled_date && <span><Calendar size={11} className="inline mr-1" />{formatDate(a.scheduled_date)}</span>}
          {a.engineer?.name && <span><User size={11} className="inline mr-1" />{a.engineer.name}</span>}
          <span className={`badge text-xs capitalize ${a.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : a.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/50 text-slate-400'}`}>
            {a.status?.replace('_', ' ')}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {a.equipment?.next_service_date && (
          <span className={`badge text-xs ${days < 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : days <= 7 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-700/50 text-slate-400'}`}>
            {days < 0 ? `${Math.abs(days)}d over` : `${days}d left`}
          </span>
        )}
        {onAssign && (
          <button onClick={onAssign} className="btn-cyan text-xs py-1.5 px-3">
            <User size={13} /> Assign
          </button>
        )}
      </div>
    </div>
  )
}

// ── Reusable assign-engineer form panel ──────────────────────────────────────
function AssignModal({ open, title, equipment, engineers, engineerId, setEngineerId, scheduledDate,
  setScheduledDate, serviceType, setServiceType, priority, setPriority, instructions, setInstructions,
  onClose, onSubmit, submitting, submitLabel, requireEngineer }: any) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      {open && (
        <div className="space-y-5">
          {equipment && (
            <div className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-200">{equipment.facility_name ?? 'Equipment'}</p>
              <p className="text-xs text-slate-400 mt-0.5">{equipment.subcategory?.name} • {equipment.serial_number}</p>
              <p className="text-xs text-slate-500">{equipment.region?.name}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Service Date</label>
              <input type="date" value={scheduledDate} onChange={(e: any) => setScheduledDate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">Service Type</label>
              <select value={serviceType} onChange={(e: any) => setServiceType(e.target.value)} className="input-field">
                <option value="preventive">Preventive</option>
                <option value="corrective">Corrective</option>
                <option value="calibration">Calibration</option>
                <option value="installation">Installation</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select value={priority} onChange={(e: any) => setPriority(e.target.value)} className="input-field">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Special Instructions</label>
            <textarea value={instructions} onChange={(e: any) => setInstructions(e.target.value)}
              rows={2} className="input-field resize-none" placeholder="Notes for engineer…" />
          </div>

          <div>
            <label className="label">Select Engineer</label>
            {!engineers.length ? (
              <p className="text-sm text-slate-500 py-2">No engineers yet. Add via User Management.</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {engineers.map((eng: any) => (
                  <label key={eng.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${engineerId === eng.id ? 'border-biocare-cyan-500 bg-biocare-cyan-500/10' : 'border-slate-700 hover:border-slate-600'}`}>
                    <input type="radio" name="eng2" value={eng.id} checked={engineerId === eng.id} onChange={() => setEngineerId(eng.id)} className="sr-only" />
                    <div className="w-8 h-8 rounded-full bg-biocare-purple-500/20 flex items-center justify-center text-xs font-bold text-biocare-purple-300 flex-shrink-0">
                      {eng.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-200">{eng.name}</p>
                      <p className="text-xs text-slate-500">{eng.specializations?.join(', ') || 'General'}</p>
                    </div>
                    <span className={`badge text-xs ${getAvailabilityClasses(eng.availability_status)}`}>
                      {getAvailabilityLabel(eng.availability_status)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={onSubmit} disabled={(requireEngineer && !engineerId) || submitting} className="btn-primary">
              {submitting ? 'Saving…' : submitLabel}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
