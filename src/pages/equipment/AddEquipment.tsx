import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, ArrowLeft, Info } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PageSpinner } from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import type { EquipmentFormData } from '@/types'

export default function AddEquipment() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const qc = useQueryClient()
  const isEdit = !!id

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<EquipmentFormData>({
    defaultValues: { service_interval_days: 90, status: 'active', sale_type: 'cash' }
  })
  const saleType = watch('sale_type')
  const categoryId = watch('category_id')

  const { data: categories } = useQuery({
    queryKey: ['categories-with-sub'],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('*, subcategories(*)')
        .eq('is_active', true)
        .order('name')
      return data ?? []
    },
  })

  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data } = await supabase.from('regions').select('*').eq('is_active', true).order('name')
      return data ?? []
    },
  })

  const subcategories = categories?.find((c: any) => c.id === categoryId)?.subcategories ?? []

  const { data: existingEquipment, isLoading: loadingEquipment } = useQuery({
    queryKey: ['equipment-edit', id],
    queryFn: async () => {
      if (!id) return null
      const { data } = await supabase.from('equipment').select('*').eq('id', id).single()
      return data
    },
    enabled: !!id,
  })

  useEffect(() => {
    if (existingEquipment) {
      const e = existingEquipment
      Object.keys(e).forEach(k => {
        if (k !== 'id' && k !== 'created_at' && k !== 'updated_at') {
          setValue(k as any, e[k])
        }
      })
    }
  }, [existingEquipment, setValue])

  const mutation = useMutation({
    mutationFn: async (data: EquipmentFormData) => {
      const payload = {
        ...data,
        created_by: profile?.id,
        next_service_date: data.installation_date && data.service_interval_days
          ? new Date(new Date(data.installation_date).getTime() + data.service_interval_days * 86400000).toISOString().split('T')[0]
          : undefined,
        // Clean null HP fields if not hire_purchase
        ...(data.sale_type !== 'hire_purchase' ? {
          hp_total_price: null, hp_down_payment: null, hp_installment_amount: null,
          hp_installment_frequency: null, hp_total_installments: null,
          hp_installments_paid: null, hp_payment_status: null, hp_final_payment_date: null
        } : {})
      }

      if (isEdit) {
        const { error } = await supabase.from('equipment').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('equipment').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Equipment updated!' : 'Equipment added!')
      qc.invalidateQueries({ queryKey: ['equipment-list'] })
      navigate('/equipment')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to save equipment'),
  })

  if (loadingEquipment) return <PageSpinner />

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary text-sm h-9 w-9 p-0 justify-center">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="page-title">{isEdit ? 'Edit Equipment' : 'Add Equipment'}</h1>
          <p className="text-slate-500 text-sm">Fill in the equipment details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-5">
        {/* Basic Info */}
        <Section title="Basic Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Serial Number *" error={errors.serial_number?.message}>
              <input {...register('serial_number', { required: 'Required' })} className="input-field" placeholder="SN-001234" />
            </Field>
            <Field label="Category *" error={errors.category_id?.message}>
              <select {...register('category_id', { required: 'Required' })} className="input-field">
                <option value="">Select category</option>
                {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Model / Subcategory *" error={errors.subcategory_id?.message}>
              <select {...register('subcategory_id', { required: 'Required' })} className="input-field" disabled={!categoryId}>
                <option value="">Select model</option>
                {subcategories.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select {...register('status')} className="input-field">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="decommissioned">Decommissioned</option>
              </select>
            </Field>
          </div>
        </Section>

        {/* Facility Info */}
        <Section title="Facility Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Facility Name *" error={errors.facility_name?.message} className="md:col-span-2">
              <input {...register('facility_name', { required: 'Required' })} className="input-field" placeholder="General Hospital Nairobi" />
            </Field>
            <Field label="Contact Person">
              <input {...register('facility_contact_name')} className="input-field" placeholder="Dr. Jane Doe" />
            </Field>
            <Field label="Phone Number">
              <input {...register('facility_contact_phone')} className="input-field" placeholder="+254 700 000 000" />
            </Field>
            <Field label="Email">
              <input {...register('facility_contact_email')} type="email" className="input-field" placeholder="hospital@email.com" />
            </Field>
            <Field label="Region">
              <select {...register('region_id')} className="input-field">
                <option value="">Select region</option>
                {regions?.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="County / Town" className="md:col-span-2">
              <input {...register('county')} className="input-field" placeholder="e.g., Nairobi, Westlands" />
            </Field>
            <Field label="Facility Address" className="md:col-span-2">
              <input {...register('facility_address')} className="input-field" placeholder="Street address" />
            </Field>
          </div>
        </Section>

        {/* Service Info */}
        <Section title="Service Schedule">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Installation Date">
              <input {...register('installation_date')} type="date" className="input-field" />
            </Field>
            <Field label="Service Interval (days)">
              <input {...register('service_interval_days', { valueAsNumber: true })} type="number" className="input-field" min={1} />
            </Field>
            <Field label="Warranty Expiry">
              <input {...register('warranty_expiry_date')} type="date" className="input-field" />
            </Field>
          </div>
          <Field label="Notes" className="mt-4">
            <textarea {...register('notes')} rows={3} className="input-field resize-none" placeholder="Any additional notes..." />
          </Field>
        </Section>

        {/* Sale Type */}
        <Section title="Acquisition & Billing">
          <Field label="Sale Type *" error={errors.sale_type?.message}>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'cash', label: 'Cash Sale', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-400', desc: 'Customer pays for service' },
                { value: 'placement', label: 'Placement', color: 'border-orange-500 bg-orange-500/10 text-orange-400', desc: 'Free servicing' },
                { value: 'hire_purchase', label: 'Hire Purchase', color: 'border-blue-500 bg-blue-500/10 text-blue-400', desc: 'Installment payments' },
              ].map(opt => (
                <label key={opt.value}
                  className={`cursor-pointer rounded-xl border-2 p-3 text-center transition-all ${saleType === opt.value ? opt.color : 'border-slate-700 bg-slate-800/50 text-slate-400'}`}>
                  <input type="radio" value={opt.value} {...register('sale_type')} className="sr-only" />
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-xs mt-0.5 opacity-70">{opt.desc}</p>
                </label>
              ))}
            </div>
          </Field>

          {saleType === 'hire_purchase' && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
              <div className="md:col-span-2 flex items-center gap-2 text-blue-400 text-xs">
                <Info size={13} /> Hire Purchase details — service is free while payments are active
              </div>
              <Field label="Total Price (KES)">
                <input {...register('hp_total_price', { valueAsNumber: true })} type="number" className="input-field" />
              </Field>
              <Field label="Down Payment (KES)">
                <input {...register('hp_down_payment', { valueAsNumber: true })} type="number" className="input-field" />
              </Field>
              <Field label="Installment Amount (KES)">
                <input {...register('hp_installment_amount', { valueAsNumber: true })} type="number" className="input-field" />
              </Field>
              <Field label="Frequency">
                <select {...register('hp_installment_frequency')} className="input-field">
                  <option value="">Select</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </Field>
              <Field label="Total Installments">
                <input {...register('hp_total_installments', { valueAsNumber: true })} type="number" className="input-field" />
              </Field>
              <Field label="Installments Paid">
                <input {...register('hp_installments_paid', { valueAsNumber: true })} type="number" className="input-field" />
              </Field>
              <Field label="Payment Status">
                <select {...register('hp_payment_status')} className="input-field">
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="defaulted">Defaulted</option>
                </select>
              </Field>
              <Field label="Final Payment Date">
                <input {...register('hp_final_payment_date')} type="date" className="input-field" />
              </Field>
            </div>
          )}
        </Section>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : <><Save size={15} /> {isEdit ? 'Update Equipment' : 'Add Equipment'}</>}
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
