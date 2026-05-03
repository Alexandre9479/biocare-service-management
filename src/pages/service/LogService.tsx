import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Camera, Upload, Info, Save } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import supabase from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { calculateServiceCharge } from '@/utils/serviceCharges'
import { formatCurrency, getServiceTypeLabel } from '@/utils/helpers'
import { PageSpinner } from '@/components/ui/Spinner'
import SaleTypeBadge from '@/components/equipment/SaleTypeBadge'
import toast from 'react-hot-toast'
import type { ServiceLogFormData, ServiceType } from '@/types'

interface PartRow { part_name: string; part_number: string; quantity: number; unit_cost: number; is_chargeable: boolean }

export default function LogService() {
  const { assignmentId, equipmentId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [parts, setParts] = useState<PartRow[]>([])
  const [images, setImages] = useState<{ file: File; type: string; caption: string; preview: string }[]>([])
  const [serviceRate, setServiceRate] = useState(5000)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ServiceLogFormData>({
    defaultValues: { service_date: new Date().toISOString().split('T')[0], service_type: 'preventive' }
  })
  const serviceType = watch('service_type')

  // Load assignment or equipment
  const { data: assignment } = useQuery({
    queryKey: ['assignment-detail', assignmentId],
    queryFn: async () => {
      if (!assignmentId) return null
      const { data } = await supabase
        .from('service_assignments')
        .select(`*, equipment:equipment_id(*, category:category_id(name), subcategory:subcategory_id(name), region:region_id(name))`)
        .eq('id', assignmentId)
        .single()
      return data
    },
    enabled: !!assignmentId,
  })

  const { data: equipment } = useQuery({
    queryKey: ['equipment-for-log', equipmentId || assignment?.equipment_id],
    queryFn: async () => {
      const eid = equipmentId || assignment?.equipment_id
      if (!eid) return null
      const { data } = await supabase
        .from('equipment')
        .select(`*, category:category_id(name), subcategory:subcategory_id(name), region:region_id(name)`)
        .eq('id', eid)
        .single()
      return data
    },
    enabled: !!(equipmentId || assignment?.equipment_id),
  })

  const { data: rates } = useQuery({
    queryKey: ['service-rates'],
    queryFn: async () => {
      const { data } = await supabase.from('service_rates').select('*').eq('is_active', true)
      return data ?? []
    },
  })

  // Update service rate when type changes
  React.useEffect(() => {
    const rate = rates?.find((r: any) => r.service_type === serviceType)
    if (rate) setServiceRate(rate.rate)
  }, [serviceType, rates])

  const partsTotal = parts.reduce((sum, p) => sum + (p.is_chargeable ? p.quantity * p.unit_cost : 0), 0)
  const chargeResult = equipment ? calculateServiceCharge(equipment as any, serviceRate, partsTotal) : null

  const addPart = () => setParts(ps => [...ps, { part_name: '', part_number: '', quantity: 1, unit_cost: 0, is_chargeable: true }])
  const removePart = (i: number) => setParts(ps => ps.filter((_, idx) => idx !== i))
  const updatePart = (i: number, field: keyof PartRow, value: any) =>
    setParts(ps => ps.map((p, idx) => idx === i ? { ...p, [field]: value } : p))

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] },
    maxSize: 5 * 1024 * 1024,
    onDrop: (accepted) => {
      accepted.forEach(file => {
        const preview = URL.createObjectURL(file)
        setImages(imgs => [...imgs, { file, type: 'other', caption: '', preview }])
      })
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: ServiceLogFormData) => {
      if (!equipment) throw new Error('Equipment not found')
      const eid = equipment.id

      // Create service log
      const { data: log, error: logErr } = await supabase
        .from('service_logs')
        .insert({
          assignment_id: assignmentId ?? null,
          equipment_id: eid,
          engineer_id: profile!.id,
          service_date: data.service_date,
          service_type: data.service_type,
          findings: data.findings,
          actions_taken: data.actions_taken,
          service_duration_hours: data.service_duration_hours,
          next_recommended_date: data.next_recommended_date || null,
          client_name: data.client_name,
          client_feedback: data.client_feedback,
          service_charge: chargeResult?.serviceCharge ?? 0,
          parts_charge: chargeResult?.partsCharge ?? 0,
          total_charge: chargeResult?.totalCharge ?? 0,
          charge_status: chargeResult?.chargeStatus ?? '',
          payment_status: chargeResult?.isChargeable ? 'pending' : 'waived',
        })
        .select()
        .single()

      if (logErr) throw logErr

      // Insert parts
      if (parts.length > 0) {
        const partsPayload = parts.filter(p => p.part_name).map(p => ({
          service_log_id: log.id,
          part_name: p.part_name,
          part_number: p.part_number || null,
          quantity: p.quantity,
          unit_cost: p.unit_cost,
          total_cost: p.quantity * p.unit_cost,
          is_chargeable: p.is_chargeable,
        }))
        if (partsPayload.length) await supabase.from('service_parts').insert(partsPayload)
      }

      // Upload images
      for (const img of images) {
        const fileName = `${profile!.id}/${log.id}/${Date.now()}-${img.file.name}`
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('service-images')
          .upload(fileName, img.file)
        if (!uploadErr && uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('service-images').getPublicUrl(fileName)
          await supabase.from('service_images').insert({
            service_log_id: log.id,
            image_url: publicUrl,
            image_type: img.type,
            caption: img.caption || null,
            file_name: img.file.name,
            file_size: img.file.size,
          })
        }
      }

      // Notify admin
      const admins = await supabase.from('profiles').select('id').eq('role', 'admin')
      if (admins.data?.length) {
        const notifs = admins.data.map(a => ({
          recipient_id: a.id,
          type: 'completion',
          title: 'Service Completed',
          message: `${profile!.name} completed service at ${equipment.facility_name}`,
          data: { equipment_id: eid, log_id: log.id },
          priority: 'low',
        }))
        await supabase.from('notifications').insert(notifs)
      }
    },
    onSuccess: () => {
      toast.success('Service logged successfully!')
      qc.invalidateQueries({ queryKey: ['service-logs'] })
      qc.invalidateQueries({ queryKey: ['equipment-detail'] })
      navigate(-1)
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to log service'),
  })

  if (!equipment && (assignmentId || equipmentId)) return <PageSpinner />

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary text-sm h-9 w-9 p-0 justify-center">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="page-title">Log Service</h1>
          <p className="text-slate-500 text-sm">{equipment?.facility_name}</p>
        </div>
      </div>

      {/* Equipment Info */}
      {equipment && (
        <div className="card p-4 flex items-center gap-4 flex-wrap">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-200">{equipment.facility_name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {(equipment as any).subcategory?.name} • S/N: {equipment.serial_number}
            </p>
          </div>
          <SaleTypeBadge saleType={(equipment as any).sale_type} />
        </div>
      )}

      {/* Charge Status Banner */}
      {chargeResult && (
        <div className={`card p-4 border ${chargeResult.isChargeable
          ? 'border-orange-500/30 bg-orange-500/5'
          : 'border-emerald-500/30 bg-emerald-500/5'}`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Info size={15} className={chargeResult.isChargeable ? 'text-orange-400' : 'text-emerald-400'} />
              <span className={`text-sm font-semibold ${chargeResult.isChargeable ? 'text-orange-400' : 'text-emerald-400'}`}>
                {chargeResult.chargeStatus}
              </span>
            </div>
            <span className={`text-lg font-bold ${chargeResult.isChargeable ? 'text-orange-300' : 'text-emerald-300'}`}>
              {chargeResult.chargeLabel}
            </span>
          </div>
          {chargeResult.isChargeable && (
            <div className="mt-2 text-xs text-slate-500 flex gap-4">
              <span>Service fee: {formatCurrency(chargeResult.serviceCharge)}</span>
              <span>Parts: {formatCurrency(chargeResult.partsCharge)}</span>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5">
        {/* Service Details */}
        <Section title="Service Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Service Date *">
              <input {...register('service_date', { required: true })} type="date" className="input-field" />
            </Field>
            <Field label="Service Type">
              <select {...register('service_type')} className="input-field">
                {['preventive', 'corrective', 'installation', 'calibration', 'emergency'].map(t => (
                  <option key={t} value={t}>{getServiceTypeLabel(t)}</option>
                ))}
              </select>
            </Field>
            <Field label="Duration (hours)">
              <input {...register('service_duration_hours', { valueAsNumber: true })} type="number" step="0.5" min="0" className="input-field" />
            </Field>
            <Field label="Next Recommended Date">
              <input {...register('next_recommended_date')} type="date" className="input-field" />
            </Field>
            <Field label="Findings" className="md:col-span-2">
              <textarea {...register('findings')} rows={3} className="input-field resize-none"
                placeholder="What was found during inspection..." />
            </Field>
            <Field label="Actions Taken" className="md:col-span-2">
              <textarea {...register('actions_taken')} rows={3} className="input-field resize-none"
                placeholder="What was done to resolve issues..." />
            </Field>
          </div>
        </Section>

        {/* Parts */}
        <Section title="Parts Used">
          <div className="space-y-3">
            {parts.map((part, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  {i === 0 && <label className="label text-xs">Part Name</label>}
                  <input value={part.part_name} onChange={e => updatePart(i, 'part_name', e.target.value)}
                    className="input-field text-sm h-9" placeholder="Part name" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="label text-xs">Part No.</label>}
                  <input value={part.part_number} onChange={e => updatePart(i, 'part_number', e.target.value)}
                    className="input-field text-sm h-9" placeholder="Optional" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="label text-xs">Qty</label>}
                  <input type="number" value={part.quantity} min={1}
                    onChange={e => updatePart(i, 'quantity', Number(e.target.value))}
                    className="input-field text-sm h-9" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="label text-xs">Unit Cost</label>}
                  <input type="number" value={part.unit_cost} min={0}
                    onChange={e => updatePart(i, 'unit_cost', Number(e.target.value))}
                    className="input-field text-sm h-9" />
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  {i === 0 && <label className="label text-xs">Bill</label>}
                  <input type="checkbox" checked={part.is_chargeable}
                    onChange={e => updatePart(i, 'is_chargeable', e.target.checked)}
                    className="w-4 h-4 accent-biocare-purple-500" />
                </div>
                <div className="col-span-1">
                  <button type="button" onClick={() => removePart(i)}
                    className="h-9 w-9 flex items-center justify-center text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addPart} className="btn-secondary text-sm">
              <Plus size={14} /> Add Part
            </button>
          </div>
        </Section>

        {/* Photos */}
        <Section title="Service Photos">
          <div {...getRootProps()} className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center cursor-pointer hover:border-slate-600 transition-colors mb-4">
            <input {...getInputProps()} />
            <Camera size={24} className="mx-auto mb-2 text-slate-600" />
            <p className="text-sm text-slate-400">Drop photos or click to upload</p>
            <p className="text-xs text-slate-600 mt-1">JPEG, PNG, GIF — max 5MB each</p>
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {images.map((img, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden border border-slate-700">
                  <img src={img.preview} alt="" className="w-full h-32 object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col p-2 gap-1">
                    <select value={img.type}
                      onChange={e => setImages(imgs => imgs.map((im, idx) => idx === i ? { ...im, type: e.target.value } : im))}
                      className="text-xs bg-black/50 text-white rounded px-1 py-0.5 border border-white/20">
                      <option value="before">Before</option>
                      <option value="during">During</option>
                      <option value="after">After</option>
                      <option value="other">Other</option>
                    </select>
                    <input placeholder="Caption..."
                      value={img.caption}
                      onChange={e => setImages(imgs => imgs.map((im, idx) => idx === i ? { ...im, caption: e.target.value } : im))}
                      className="text-xs bg-black/50 text-white rounded px-1 py-0.5 border border-white/20 w-full" />
                    <button type="button"
                      onClick={() => setImages(imgs => imgs.filter((_, idx) => idx !== i))}
                      className="text-xs text-red-400 hover:text-red-300">Remove</button>
                  </div>
                  <span className="absolute top-1 left-1 badge bg-black/60 text-white border-0 text-[10px]">{img.type}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Client */}
        <Section title="Client Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Client Name / Signatory">
              <input {...register('client_name')} className="input-field" placeholder="Client name" />
            </Field>
            <div />
            <Field label="Client Feedback / Comments" className="md:col-span-2">
              <textarea {...register('client_feedback')} rows={2} className="input-field resize-none"
                placeholder="Client remarks..." />
            </Field>
          </div>
        </Section>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : <><Save size={15} /> Submit Service Log</>}
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4 pb-3 border-b border-slate-800">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, error, children, className }: {
  label: string; error?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}
