import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Save, X, MessageCircle, CheckCircle, AlertTriangle } from 'lucide-react'
import supabase from '@/lib/supabase'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/utils/helpers'
import { sendTextMessage, getWhatsAppSettings, normalisePhone } from '@/utils/whatsapp'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

type TabType = 'categories' | 'regions' | 'rates' | 'whatsapp'

export default function Settings() {
  const [tab, setTab] = useState<TabType>('categories')

  const tabs: { key: TabType; label: string }[] = [
    { key: 'categories', label: 'Categories & Models' },
    { key: 'regions', label: 'Regions' },
    { key: 'rates', label: 'Service Rates' },
    { key: 'whatsapp', label: '💬 WhatsApp API' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-slate-500 text-sm">Manage categories, regions, service rates, and integrations</p>
      </div>

      <div className="flex gap-1 bg-slate-900 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t.key
              ? 'bg-biocare-purple-500 text-white'
              : 'text-slate-400 hover:text-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'categories' && <CategoriesTab />}
      {tab === 'regions' && <RegionsTab />}
      {tab === 'rates' && <RatesTab />}
      {tab === 'whatsapp' && <WhatsAppTab />}
    </div>
  )
}

function CategoriesTab() {
  const qc = useQueryClient()
  const [newCat, setNewCat] = useState('')
  const [newSub, setNewSub] = useState<Record<string, string>>({})
  const [newMfr, setNewMfr] = useState<Record<string, string>>({})

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*, subcategories(*)').order('name')
      return data ?? []
    },
  })

  const addCategory = async () => {
    if (!newCat.trim()) return
    const { error } = await supabase.from('categories').insert({ name: newCat.trim() })
    if (!error) { toast.success('Category added'); qc.invalidateQueries({ queryKey: ['categories-settings'] }); setNewCat('') }
    else toast.error(error.message)
  }

  const addSubcategory = async (catId: string) => {
    const name = newSub[catId]?.trim()
    if (!name) return
    const { error } = await supabase.from('subcategories').insert({
      category_id: catId, name, manufacturer: newMfr[catId]?.trim() || null
    })
    if (!error) {
      toast.success('Model added')
      qc.invalidateQueries({ queryKey: ['categories-settings'] })
      qc.invalidateQueries({ queryKey: ['categories-with-sub'] })
      setNewSub(s => ({ ...s, [catId]: '' }))
      setNewMfr(s => ({ ...s, [catId]: '' }))
    } else toast.error(error.message)
  }

  const deleteSub = async (id: string) => {
    const { error } = await supabase.from('subcategories').delete().eq('id', id)
    if (!error) qc.invalidateQueries({ queryKey: ['categories-settings'] })
    else toast.error(error.message)
  }

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-4">
      {/* Add Category */}
      <div className="card p-4 flex gap-3">
        <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New category name"
          className="input-field flex-1 text-sm h-9" onKeyDown={e => e.key === 'Enter' && addCategory()} />
        <button onClick={addCategory} className="btn-primary text-sm h-9"><Plus size={14} /> Add Category</button>
      </div>

      {/* Categories List */}
      {(categories ?? []).map((cat: any) => (
        <div key={cat.id} className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/30">
            <h3 className="text-sm font-semibold text-slate-200">{cat.name}</h3>
          </div>
          <div className="p-4 space-y-3">
            {/* Existing subcategories */}
            <div className="flex flex-wrap gap-2">
              {cat.subcategories?.map((sub: any) => (
                <div key={sub.id} className="flex items-center gap-1 badge bg-slate-700/50 text-slate-300 border border-slate-700">
                  <span>{sub.name}</span>
                  {sub.manufacturer && <span className="text-slate-500">({sub.manufacturer})</span>}
                  <button onClick={() => deleteSub(sub.id)} className="text-red-400/70 hover:text-red-400 ml-1">
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
            {/* Add subcategory */}
            <div className="flex gap-2">
              <input value={newSub[cat.id] ?? ''} onChange={e => setNewSub(s => ({ ...s, [cat.id]: e.target.value }))}
                placeholder="Model name" className="input-field text-sm h-8 flex-1" />
              <input value={newMfr[cat.id] ?? ''} onChange={e => setNewMfr(s => ({ ...s, [cat.id]: e.target.value }))}
                placeholder="Manufacturer" className="input-field text-sm h-8 w-36" />
              <button onClick={() => addSubcategory(cat.id)} className="btn-secondary text-xs h-8 px-3">
                <Plus size={12} /> Add
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function RegionsTab() {
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newCounty, setNewCounty] = useState<Record<string, string>>({})

  const { data: regions } = useQuery({
    queryKey: ['regions-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('regions').select('*').order('name')
      return data ?? []
    },
  })

  const addRegion = async () => {
    if (!newName.trim()) return
    const { error } = await supabase.from('regions').insert({ name: newName.trim(), counties: [] })
    if (!error) { toast.success('Region added'); qc.invalidateQueries({ queryKey: ['regions-settings'] }); qc.invalidateQueries({ queryKey: ['regions'] }); setNewName('') }
    else toast.error(error.message)
  }

  const addCounty = async (region: any) => {
    const county = newCounty[region.id]?.trim()
    if (!county) return
    const { error } = await supabase.from('regions').update({
      counties: [...(region.counties ?? []), county]
    }).eq('id', region.id)
    if (!error) { qc.invalidateQueries({ queryKey: ['regions-settings'] }); setNewCounty(s => ({ ...s, [region.id]: '' })) }
    else toast.error(error.message)
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex gap-3">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New region name (e.g., Nairobi Region)"
          className="input-field flex-1 text-sm h-9" onKeyDown={e => e.key === 'Enter' && addRegion()} />
        <button onClick={addRegion} className="btn-primary text-sm h-9"><Plus size={14} /> Add Region</button>
      </div>
      {(regions ?? []).map((r: any) => (
        <div key={r.id} className="card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">{r.name}</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {r.counties?.map((c: string) => (
              <span key={c} className="badge bg-slate-700/50 text-slate-300 border border-slate-700 text-xs">{c}</span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newCounty[r.id] ?? ''} onChange={e => setNewCounty(s => ({ ...s, [r.id]: e.target.value }))}
              placeholder="Add county" className="input-field text-sm h-8 flex-1" />
            <button onClick={() => addCounty(r)} className="btn-secondary text-xs h-8 px-3"><Plus size={12} /> Add</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function RatesTab() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [editRate, setEditRate] = useState(0)

  const { data: rates } = useQuery({
    queryKey: ['rates-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('service_rates').select('*, category:category_id(name)').order('service_type')
      return data ?? []
    },
  })

  const updateRate = async (id: string) => {
    const { error } = await supabase.from('service_rates').update({ rate: editRate }).eq('id', id)
    if (!error) { toast.success('Rate updated'); qc.invalidateQueries({ queryKey: ['rates-settings'] }); qc.invalidateQueries({ queryKey: ['service-rates'] }); setEditing(null) }
    else toast.error(error.message)
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800">
        <h2 className="section-title">Standard Service Rates (KES)</h2>
        <p className="text-xs text-slate-500 mt-0.5">These rates apply to Cash Sales and completed Hire Purchase equipment</p>
      </div>
      <div className="divide-y divide-slate-800">
        {(rates ?? []).map((r: any) => (
          <div key={r.id} className="px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-200 capitalize">{r.service_type?.replace('_', ' ')}</p>
              <p className="text-xs text-slate-500">{r.description}</p>
            </div>
            {editing === r.id ? (
              <div className="flex items-center gap-2">
                <input type="number" value={editRate} onChange={e => setEditRate(Number(e.target.value))}
                  className="input-field text-sm h-8 w-28" />
                <button onClick={() => updateRate(r.id)} className="btn-primary text-xs h-8 px-3">
                  <Save size={12} />
                </button>
                <button onClick={() => setEditing(null)} className="btn-secondary text-xs h-8 px-3">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-emerald-400">{formatCurrency(r.rate)}</span>
                <button onClick={() => { setEditing(r.id); setEditRate(r.rate) }}
                  className="p-1.5 text-slate-500 hover:text-biocare-cyan-400 hover:bg-slate-800 rounded-lg transition-colors">
                  <Edit2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── WhatsApp Settings Tab ─────────────────────────────────────────────────────
function WhatsAppTab() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [testPhone, setTestPhone] = useState('')
  const [testing, setTesting] = useState(false)
  const [showToken, setShowToken] = useState(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['whatsapp-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['whatsapp_phone_number_id', 'whatsapp_access_token', 'whatsapp_enabled', 'whatsapp_api_version'])
      const map: Record<string, string> = {}
      data?.forEach(r => { map[r.key] = r.value ?? '' })
      return map
    },
  })

  const [phoneId, setPhoneId] = useState('')
  const [token,   setToken]   = useState('')
  const [enabled, setEnabled] = useState(false)
  const [apiVer,  setApiVer]  = useState('v21.0')

  React.useEffect(() => {
    if (settings) {
      setPhoneId(settings.whatsapp_phone_number_id ?? '')
      setToken(settings.whatsapp_access_token ?? '')
      setEnabled(settings.whatsapp_enabled === 'true')
      setApiVer(settings.whatsapp_api_version ?? 'v21.0')
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: 'whatsapp_phone_number_id', value: phoneId },
        { key: 'whatsapp_access_token',    value: token },
        { key: 'whatsapp_enabled',         value: String(enabled) },
        { key: 'whatsapp_api_version',     value: apiVer },
      ]
      for (const u of updates) {
        const { error } = await supabase
          .from('system_settings')
          .update({ value: u.value, updated_by: profile?.id, updated_at: new Date().toISOString() })
          .eq('key', u.key)
        if (error) throw error
      }
    },
    onSuccess: () => { toast.success('WhatsApp settings saved!'); qc.invalidateQueries({ queryKey: ['whatsapp-settings'] }) },
    onError: (e: any) => toast.error(e.message),
  })

  const handleTest = async () => {
    if (!testPhone) { toast.error('Enter a phone number to test'); return }
    setTesting(true)
    try {
      const cfg = await getWhatsAppSettings()
      if (!cfg?.phone_number_id || !cfg?.access_token) {
        toast.error('Save credentials first'); return
      }
      const result = await sendTextMessage(cfg, testPhone,
        '✅ Test message from Biocare Service Management System. WhatsApp integration is working!')
      if (result.success) toast.success(`Message sent! ID: ${result.messageId}`)
      else toast.error(`Failed: ${result.error}`)
    } finally {
      setTesting(false)
    }
  }

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-5">
      {/* Setup guide */}
      <div className="card p-5 border-biocare-cyan-500/20 bg-biocare-cyan-500/5">
        <h3 className="text-sm font-semibold text-biocare-cyan-400 mb-2 flex items-center gap-2">
          <MessageCircle size={16} /> WhatsApp Business Cloud API Setup (Meta Direct — Free)
        </h3>
        <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
          <li>Go to <span className="text-biocare-cyan-400 font-mono">developers.facebook.com</span> → Create App → Business</li>
          <li>Add <strong className="text-slate-300">WhatsApp</strong> product to your app</li>
          <li>Under <strong className="text-slate-300">WhatsApp → API Setup</strong>, get your <strong className="text-slate-300">Phone Number ID</strong></li>
          <li>Generate a <strong className="text-slate-300">Permanent Access Token</strong> via System Users in Meta Business Settings</li>
          <li>First 1,000 conversations per month are <strong className="text-emerald-400">free</strong></li>
          <li>Paste both values below and enable WhatsApp notifications</li>
        </ol>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="section-title">Credentials</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-200">Enable WhatsApp Notifications</p>
            <p className="text-xs text-slate-500">Send automated messages to engineers and facilities</p>
          </div>
          <button onClick={() => setEnabled(e => !e)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div>
          <label className="label">Phone Number ID</label>
          <input value={phoneId} onChange={e => setPhoneId(e.target.value)}
            className="input-field font-mono" placeholder="1234567890123456" />
          <p className="text-xs text-slate-600 mt-1">Found in Meta Developer Console → WhatsApp → API Setup</p>
        </div>

        <div>
          <label className="label">Access Token</label>
          <div className="relative">
            <input type={showToken ? 'text' : 'password'} value={token} onChange={e => setToken(e.target.value)}
              className="input-field font-mono pr-16" placeholder="EAAxxxxxxx…" />
            <button type="button" onClick={() => setShowToken(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300">
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-1">Use a Permanent Token from Meta Business System Users — never expires</p>
        </div>

        <div>
          <label className="label">API Version</label>
          <select value={apiVer} onChange={e => setApiVer(e.target.value)} className="input-field w-32">
            {['v21.0', 'v20.0', 'v19.0'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div className="flex justify-end">
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary text-sm">
            <Save size={14} /> {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Test */}
      <div className="card p-5 space-y-3">
        <h3 className="section-title">Test Connection</h3>
        <p className="text-xs text-slate-500">
          Send a test message to verify your credentials. The recipient must have WhatsApp and must have messaged your business number first (24-hour window rule) — or use a Meta test number.
        </p>
        <div className="flex gap-3">
          <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
            placeholder="+254 712 345 678" className="input-field flex-1" />
          <button onClick={handleTest} disabled={testing} className="btn-cyan text-sm">
            {testing ? 'Sending…' : '📨 Send Test'}
          </button>
        </div>
      </div>

      {/* Notifications that use WhatsApp */}
      <div className="card p-5">
        <h3 className="section-title mb-3">Automatic Notifications Sent</h3>
        <div className="space-y-2">
          {[
            { event: 'Engineer Assignment', recipient: 'Engineer phone number', trigger: 'When admin assigns a service job' },
            { event: 'Service Reminder', recipient: 'Facility contact phone', trigger: '1 day before scheduled service' },
            { event: 'Warranty Expiry Alert', recipient: 'Facility contact phone', trigger: '90, 60, 30 days before expiry' },
          ].map(n => (
            <div key={n.event} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-xl">
              <CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-200">{n.event}</p>
                <p className="text-xs text-slate-500">To: {n.recipient} • Trigger: {n.trigger}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
