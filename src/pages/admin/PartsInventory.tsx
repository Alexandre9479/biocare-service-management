import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, AlertTriangle, Package, TrendingDown, TrendingUp, X } from 'lucide-react'
import supabase from '@/lib/supabase'
import Modal from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import { formatCurrency } from '@/utils/helpers'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface PartForm {
  part_name: string; part_number: string; description: string
  quantity_in_stock: number; reorder_level: number; unit_cost: number
  supplier_name: string; supplier_contact: string; location: string; notes: string
  subcategory_id: string
}

const BLANK: PartForm = {
  part_name: '', part_number: '', description: '',
  quantity_in_stock: 0, reorder_level: 5, unit_cost: 0,
  supplier_name: '', supplier_contact: '', location: '', notes: '',
  subcategory_id: '',
}

export default function PartsInventory() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const [editPart, setEditPart] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PartForm>(BLANK)
  const [movementModal, setMovementModal] = useState<any>(null)
  const [movQty, setMovQty] = useState(1)
  const [movType, setMovType] = useState<'stock_in' | 'stock_out' | 'adjustment'>('stock_in')
  const [movNotes, setMovNotes] = useState('')
  const [filterLow, setFilterLow] = useState(false)

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ['parts-inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_inventory')
        .select('*')
        .eq('is_active', true)
        .order('part_name')
      if (error) throw error
      return data ?? []
    },
  })

  const { data: subcategories = [] } = useQuery({
    queryKey: ['subcategories-flat'],
    queryFn: async () => {
      const { data } = await supabase.from('subcategories').select('id, name').eq('is_active', true).order('name')
      return data ?? []
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editPart) {
        const { error } = await supabase.from('parts_inventory').update(form).eq('id', editPart.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('parts_inventory').insert(form)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(editPart ? 'Part updated!' : 'Part added!')
      qc.invalidateQueries({ queryKey: ['parts-inventory'] })
      closeForm()
    },
    onError: (e: any) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('parts_inventory').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { toast.success('Part removed'); qc.invalidateQueries({ queryKey: ['parts-inventory'] }) },
    onError: (e: any) => toast.error(e.message),
  })

  const movementMutation = useMutation({
    mutationFn: async () => {
      if (!movementModal) throw new Error('No part selected')
      const delta = movType === 'stock_out' ? -Math.abs(movQty) : Math.abs(movQty)
      const newQty = movementModal.quantity_in_stock + delta

      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from('parts_inventory').update({ quantity_in_stock: newQty }).eq('id', movementModal.id),
        supabase.from('parts_movements').insert({
          part_id: movementModal.id,
          movement_type: movType,
          quantity: Math.abs(movQty),
          notes: movNotes || null,
          performed_by: profile?.id,
        }),
      ])
      if (e1) throw e1
      if (e2) throw e2
    },
    onSuccess: () => {
      toast.success('Stock updated!')
      qc.invalidateQueries({ queryKey: ['parts-inventory'] })
      setMovementModal(null); setMovQty(1); setMovNotes('')
    },
    onError: (e: any) => toast.error(e.message),
  })

  const openForm = (part?: any) => {
    setEditPart(part ?? null)
    setForm(part ? {
      part_name: part.part_name, part_number: part.part_number ?? '', description: part.description ?? '',
      quantity_in_stock: part.quantity_in_stock, reorder_level: part.reorder_level,
      unit_cost: part.unit_cost, supplier_name: part.supplier_name ?? '',
      supplier_contact: part.supplier_contact ?? '', location: part.location ?? '',
      notes: part.notes ?? '', subcategory_id: part.subcategory_id ?? '',
    } : BLANK)
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditPart(null); setForm(BLANK) }

  const shown = filterLow ? parts.filter((p: any) => p.quantity_in_stock <= p.reorder_level) : parts
  const lowCount = parts.filter((p: any) => p.quantity_in_stock <= p.reorder_level).length
  const totalValue = parts.reduce((s: number, p: any) => s + p.quantity_in_stock * p.unit_cost, 0)

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Parts Inventory</h1>
          <p className="text-slate-500 text-sm">{parts.length} parts tracked</p>
        </div>
        <button onClick={() => openForm()} className="btn-primary text-sm"><Plus size={15} /> Add Part</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-100">{parts.length}</p>
          <p className="text-xs text-slate-500 mt-1">Part Types</p>
        </div>
        <div className="card p-4 text-center">
          <p className={`text-2xl font-bold ${lowCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{lowCount}</p>
          <p className="text-xs text-slate-500 mt-1">Low Stock</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-biocare-cyan-400">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-slate-500 mt-1">Total Stock Value</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <button onClick={() => setFilterLow(false)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${!filterLow ? 'bg-biocare-purple-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
          All Parts
        </button>
        <button onClick={() => setFilterLow(true)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${filterLow ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
          <AlertTriangle size={14} /> Low Stock ({lowCount})
        </button>
      </div>

      {!shown.length ? (
        <EmptyState icon={<Package size={28} />} title="No parts found"
          description={filterLow ? 'No parts are low on stock.' : 'Add spare parts to track inventory.'}
          action={<button onClick={() => openForm()} className="btn-primary text-sm"><Plus size={15} /> Add Part</button>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="table-header text-left px-4 py-3">Part</th>
                  <th className="table-header text-left px-4 py-3">Part No.</th>
                  <th className="table-header text-left px-4 py-3">For Model</th>
                  <th className="table-header text-right px-4 py-3">In Stock</th>
                  <th className="table-header text-right px-4 py-3">Reorder At</th>
                  <th className="table-header text-right px-4 py-3">Unit Cost</th>
                  <th className="table-header text-left px-4 py-3">Location</th>
                  <th className="table-header px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {shown.map((part: any) => {
                  const isLow = part.quantity_in_stock <= part.reorder_level
                  const isOut = part.quantity_in_stock === 0
                  return (
                    <tr key={part.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isOut ? <AlertTriangle size={14} className="text-red-400 flex-shrink-0" /> :
                           isLow ? <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" /> : null}
                          <div>
                            <p className="text-sm font-medium text-slate-200">{part.part_name}</p>
                            {part.supplier_name && <p className="text-xs text-slate-500">{part.supplier_name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-400">{part.part_number ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {subcategories.find((s: any) => s.id === part.subcategory_id)?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold text-sm ${isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {part.quantity_in_stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">{part.reorder_level}</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-300">{formatCurrency(part.unit_cost)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{part.location ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setMovementModal(part); setMovType('stock_in') }}
                            className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Add stock">
                            <TrendingUp size={14} />
                          </button>
                          <button onClick={() => { setMovementModal(part); setMovType('stock_out') }}
                            className="p-1.5 text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors" title="Use stock">
                            <TrendingDown size={14} />
                          </button>
                          <button onClick={() => openForm(part)}
                            className="p-1.5 text-slate-500 hover:text-biocare-cyan-400 hover:bg-slate-800 rounded-lg transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => deleteMutation.mutate(part.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Part Modal */}
      <Modal open={showForm} onClose={closeForm} title={editPart ? 'Edit Part' : 'Add Part'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Part Name *', key: 'part_name', type: 'text', span: 2 },
            { label: 'Part Number', key: 'part_number', type: 'text' },
            { label: 'Location (e.g. Shelf A3)', key: 'location', type: 'text' },
            { label: 'Quantity In Stock', key: 'quantity_in_stock', type: 'number' },
            { label: 'Reorder Level', key: 'reorder_level', type: 'number' },
            { label: 'Unit Cost (KES)', key: 'unit_cost', type: 'number' },
          ].map(f => (
            <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
              <label className="label">{f.label}</label>
              <input type={f.type} value={(form as any)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                className="input-field" />
            </div>
          ))}
          <div className="col-span-2">
            <label className="label">For Equipment Model</label>
            <select value={form.subcategory_id} onChange={e => setForm(p => ({ ...p, subcategory_id: e.target.value }))} className="input-field">
              <option value="">— All models —</option>
              {subcategories.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Supplier Name</label>
            <input value={form.supplier_name} onChange={e => setForm(p => ({ ...p, supplier_name: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="label">Supplier Contact</label>
            <input value={form.supplier_contact} onChange={e => setForm(p => ({ ...p, supplier_contact: e.target.value }))} className="input-field" />
          </div>
          <div className="col-span-2">
            <label className="label">Description / Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="input-field resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={closeForm} className="btn-secondary">Cancel</button>
          <button onClick={() => saveMutation.mutate()} disabled={!form.part_name || saveMutation.isPending} className="btn-primary">
            {saveMutation.isPending ? 'Saving…' : editPart ? 'Update Part' : 'Add Part'}
          </button>
        </div>
      </Modal>

      {/* Stock Movement Modal */}
      <Modal open={!!movementModal} onClose={() => setMovementModal(null)} title="Update Stock">
        {movementModal && (
          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-xl p-3">
              <p className="text-sm font-semibold text-slate-200">{movementModal.part_name}</p>
              <p className="text-xs text-slate-400 mt-0.5">Current stock: <strong className="text-slate-200">{movementModal.quantity_in_stock}</strong></p>
            </div>
            <div>
              <label className="label">Movement Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'stock_in', label: 'Stock In', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-400' },
                  { value: 'stock_out', label: 'Stock Out', color: 'border-orange-500 bg-orange-500/10 text-orange-400' },
                  { value: 'adjustment', label: 'Adjustment', color: 'border-blue-500 bg-blue-500/10 text-blue-400' },
                ].map(opt => (
                  <label key={opt.value}
                    className={`cursor-pointer rounded-xl border-2 p-2 text-center transition-all text-xs font-semibold ${movType === opt.value ? opt.color : 'border-slate-700 text-slate-400'}`}>
                    <input type="radio" value={opt.value} checked={movType === opt.value as any}
                      onChange={() => setMovType(opt.value as any)} className="sr-only" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Quantity</label>
              <input type="number" value={movQty} onChange={e => setMovQty(Number(e.target.value))} min={1} className="input-field" />
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <input value={movNotes} onChange={e => setMovNotes(e.target.value)} className="input-field" placeholder="Reason for adjustment…" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setMovementModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => movementMutation.mutate()} disabled={movementMutation.isPending} className="btn-primary">
                {movementMutation.isPending ? 'Saving…' : 'Update Stock'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
