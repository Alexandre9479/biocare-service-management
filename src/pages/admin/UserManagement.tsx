import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react'
import supabase from '@/lib/supabase'
import Modal from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import { getAvailabilityClasses, getAvailabilityLabel } from '@/utils/helpers'
import toast from 'react-hot-toast'
import type { Profile, UserRole, AvailabilityStatus } from '@/types'

const SPECIALIZATIONS = ['Hematology', 'Immunoassay', 'Chemistry', 'Immunofluorescence', 'Urinalysis', 'ESR', 'Electrolyte', 'Blood Gas', 'Coagulation']

export default function UserManagement() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [role, setRole] = useState<UserRole>('engineer')
  const [phone, setPhone] = useState('')
  const [specs, setSpecs] = useState<string[]>([])
  const [availability, setAvailability] = useState<AvailabilityStatus>('available')

  const { data: users, isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').order('role').order('name')
      return data as Profile[]
    },
  })

  const resetForm = () => {
    setName(''); setEmail(''); setPassword(''); setRole('engineer')
    setPhone(''); setSpecs([]); setAvailability('available'); setEditUser(null)
  }

  const openAdd = () => { resetForm(); setShowModal(true) }
  const openEdit = (u: Profile) => {
    setEditUser(u); setName(u.name); setEmail(u.email); setRole(u.role)
    setPhone(u.phone ?? ''); setSpecs(u.specializations ?? []); setAvailability(u.availability_status)
    setPassword(''); setShowModal(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editUser) {
        const { error } = await supabase.from('profiles').update({
          name, role, phone: phone || null, specializations: specs, availability_status: availability
        }).eq('id', editUser.id)
        if (error) throw error
      } else {
        // Create user via Supabase Admin API is not available client-side
        // Use signUp instead — admin must send invite or user registers
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, role } }
        })
        if (error) throw error
        // Update profile with extra fields
        if (data.user) {
          await supabase.from('profiles').update({
            name, role, phone: phone || null, specializations: specs, availability_status: availability
          }).eq('id', data.user.id)
        }
      }
    },
    onSuccess: () => {
      toast.success(editUser ? 'User updated!' : 'User created! They can now sign in.')
      qc.invalidateQueries({ queryKey: ['all-users'] })
      setShowModal(false); resetForm()
    },
    onError: (e: any) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => { toast.success('User removed'); qc.invalidateQueries({ queryKey: ['all-users'] }) },
    onError: (e: any) => toast.error(e.message),
  })

  if (isLoading) return <PageSpinner />

  const admins = users?.filter(u => u.role === 'admin') ?? []
  const engineers = users?.filter(u => u.role === 'engineer') ?? []

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="text-slate-500 text-sm">{users?.length ?? 0} total users</p>
        </div>
        <button onClick={openAdd} className="btn-primary text-sm">
          <UserPlus size={15} /> Add User
        </button>
      </div>

      {/* Admins */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="section-title">Administrators ({admins.length})</h2>
        </div>
        <UserTable users={admins} onEdit={openEdit} onDelete={id => deleteMutation.mutate(id)} />
      </div>

      {/* Engineers */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="section-title">Engineers ({engineers.length})</h2>
        </div>
        <UserTable users={engineers} onEdit={openEdit} onDelete={id => deleteMutation.mutate(id)} />
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); resetForm() }}
        title={editUser ? 'Edit User' : 'Add User'} size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Jane Doe" />
          </div>
          {!editUser && (
            <>
              <div>
                <label className="label">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    className="input-field pr-10" placeholder="Minimum 8 characters" />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Role</label>
              <select value={role} onChange={e => setRole(e.target.value as UserRole)} className="input-field">
                <option value="engineer">Engineer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className="input-field" placeholder="+254 700 000 000" />
            </div>
          </div>
          {role === 'engineer' && (
            <>
              <div>
                <label className="label">Availability</label>
                <select value={availability} onChange={e => setAvailability(e.target.value as AvailabilityStatus)} className="input-field">
                  <option value="available">Available</option>
                  <option value="on_service">On Service Call</option>
                  <option value="on_leave">On Leave</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>
              <div>
                <label className="label">Specializations</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALIZATIONS.map(s => (
                    <button key={s} type="button"
                      onClick={() => setSpecs(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                      className={`badge cursor-pointer transition-colors ${specs.includes(s)
                        ? 'bg-biocare-purple-500/30 text-biocare-purple-300 border border-biocare-purple-500/50'
                        : 'bg-slate-700/50 text-slate-400 border border-slate-700 hover:border-slate-600'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowModal(false); resetForm() }} className="btn-secondary">Cancel</button>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name} className="btn-primary">
              {saveMutation.isPending ? 'Saving...' : editUser ? 'Update User' : 'Create User'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function UserTable({ users, onEdit, onDelete }: { users: Profile[]; onEdit: (u: Profile) => void; onDelete: (id: string) => void }) {
  if (!users.length) return <div className="p-6 text-center text-slate-500 text-sm">No users in this group</div>
  return (
    <div className="divide-y divide-slate-800">
      {users.map(u => (
        <div key={u.id} className="px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-biocare-purple-500/20 border border-biocare-purple-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-biocare-purple-300">{u.name.charAt(0)}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">{u.name}</p>
              <p className="text-xs text-slate-500">{u.email} {u.phone && `• ${u.phone}`}</p>
              {u.specializations?.length > 0 && (
                <p className="text-xs text-slate-600 mt-0.5">{u.specializations.join(', ')}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {u.role === 'engineer' && (
              <span className={`badge text-xs ${getAvailabilityClasses(u.availability_status)}`}>
                {getAvailabilityLabel(u.availability_status)}
              </span>
            )}
            <button onClick={() => onEdit(u)} className="p-1.5 text-slate-500 hover:text-biocare-cyan-400 hover:bg-slate-800 rounded-lg transition-colors">
              <Edit2 size={14} />
            </button>
            <button onClick={() => onDelete(u.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
