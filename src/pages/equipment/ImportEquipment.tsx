import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X } from 'lucide-react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { parseEquipmentExcel, validateImportData, getImportSummary } from '@/utils/excelImport'
import SaleTypeBadge from '@/components/equipment/SaleTypeBadge'
import StatusBadge from '@/components/equipment/StatusBadge'
import toast from 'react-hot-toast'
import type { ExcelEquipmentRow } from '@/types'

export default function ImportEquipment() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [rows, setRows] = useState<ExcelEquipmentRow[]>([])
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [defaultRegion, setDefaultRegion] = useState('')
  const [defaultInterval, setDefaultInterval] = useState(90)

  const { data: regions } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data } = await supabase.from('regions').select('id, name').eq('is_active', true).order('name')
      return data ?? []
    },
  })

  const { data: subcategories } = useQuery({
    queryKey: ['all-subcategories'],
    queryFn: async () => {
      const { data } = await supabase.from('subcategories').select('id, name, category_id').eq('is_active', true)
      return data ?? []
    },
  })

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    setParseError('')
    setRows([])
    try {
      const parsed = await parseEquipmentExcel(file)
      setRows(parsed)
      toast.success(`Parsed ${parsed.length} rows from ${file.name}`)
    } catch (err: any) {
      setParseError(err.message ?? 'Failed to parse file')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    multiple: false,
  })

  const summary = rows.length ? getImportSummary(rows) : null
  const validation = rows.length ? validateImportData(rows) : null

  const handleImport = async () => {
    if (!rows.length) return
    setImporting(true)
    let success = 0, failed = 0

    for (const row of rows) {
      try {
        // Find subcategory by name
        const sub = subcategories?.find(s =>
          s.name.toLowerCase().replace(/[\s-]/g, '') ===
          row.subcategoryName.toLowerCase().replace(/[\s-]/g, '')
        )

        const payload = {
          serial_number: row.serial_number || `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          facility_name: row.facility_name,
          facility_contact_name: row.facility_contact_name,
          facility_contact_phone: row.facility_contact_phone,
          facility_contact_email: row.facility_contact_email,
          status: row.status,
          sale_type: row.sale_type,
          category_id: sub?.category_id ?? null,
          subcategory_id: sub?.id ?? null,
          region_id: defaultRegion || null,
          service_interval_days: defaultInterval,
          hp_payment_status: row.sale_type === 'hire_purchase' ? 'active' : null,
          created_by: profile?.id,
        }

        const { error } = await supabase.from('equipment').insert(payload)
        if (error) failed++
        else success++
      } catch {
        failed++
      }
    }

    setImporting(false)
    toast.success(`Import complete: ${success} added, ${failed} failed`)
    if (success > 0) {
      qc.invalidateQueries({ queryKey: ['equipment-list'] })
      if (failed === 0) navigate('/equipment')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary text-sm h-9 w-9 p-0 justify-center">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="page-title">Import Equipment from Excel</h1>
          <p className="text-slate-500 text-sm">Upload the Biocare equipment template (.xlsx)</p>
        </div>
      </div>

      {/* Template Info */}
      <div className="card p-4 bg-biocare-cyan-500/5 border-biocare-cyan-500/20">
        <h3 className="text-sm font-semibold text-biocare-cyan-400 mb-2">Expected Template Format</h3>
        <p className="text-xs text-slate-400">Each sheet = one equipment model (e.g., "DYMIND DH36")</p>
        <p className="text-xs text-slate-400 mt-1">Row 1: Title | Row 2: Headers | Row 3+: Data</p>
        <p className="text-xs text-slate-400 mt-1">
          Headers: <span className="font-mono text-slate-300">FACILITY | EMAIL | PHONE NO. | CONTACT PERSON | S/N | STATUS | MODE OF AQUISITION</span>
        </p>
        <p className="text-xs text-slate-500 mt-2">MODE OF AQUISITION: PURCHASE = Cash Sale, PLACEMENT = Placement</p>
      </div>

      {/* Default Settings */}
      <div className="card p-5 grid grid-cols-2 gap-4">
        <div>
          <label className="label text-xs">Default Region (optional)</label>
          <select value={defaultRegion} onChange={e => setDefaultRegion(e.target.value)} className="input-field text-sm">
            <option value="">— No default region —</option>
            {regions?.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">Default Service Interval (days)</label>
          <input type="number" value={defaultInterval} onChange={e => setDefaultInterval(Number(e.target.value))}
            className="input-field text-sm" min={1} />
        </div>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${isDragActive
          ? 'border-biocare-purple-500 bg-biocare-purple-500/10'
          : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/30'}`}
      >
        <input {...getInputProps()} />
        <FileSpreadsheet size={36} className="mx-auto mb-3 text-slate-600" />
        <p className="text-sm font-medium text-slate-300">
          {isDragActive ? 'Drop the Excel file here' : 'Drop your Excel file here, or click to browse'}
        </p>
        <p className="text-xs text-slate-500 mt-1">Supports .xlsx files</p>
      </div>

      {parseError && (
        <div className="card p-4 border-red-500/30 bg-red-500/10 flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle size={16} /> {parseError}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="section-title">Import Preview</h3>
            <span className="badge bg-biocare-purple-500/20 text-biocare-purple-400 border border-biocare-purple-500/30">
              {summary.totalRows} rows
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Cash Sales', count: summary.bySaleType.cash, color: 'text-emerald-400' },
              { label: 'Placement', count: summary.bySaleType.placement, color: 'text-orange-400' },
              { label: 'Hire Purchase', count: summary.bySaleType.hire_purchase, color: 'text-blue-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800/50 rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* By sheet */}
          <div>
            <p className="text-xs text-slate-500 mb-2">By Equipment Model:</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.bySheet).map(([sheet, count]) => (
                <span key={sheet} className="badge bg-slate-700/50 text-slate-300 border border-slate-700 text-xs">
                  {sheet}: {count}
                </span>
              ))}
            </div>
          </div>

          {/* Validation errors */}
          {(validation?.errors ?? 0) > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-400 mb-2">
                {validation?.errors} rows have issues (will be skipped or imported with warnings):
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {validation?.errorDetails?.slice(0, 10).map((e, i) => (
                  <p key={i} className="text-xs text-amber-400/70">
                    Sheet "{e.sheet}" Row {e.row}: {e.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-xs">
              <thead className="bg-slate-800/80">
                <tr>
                  <th className="table-header px-3 py-2 text-left">Model</th>
                  <th className="table-header px-3 py-2 text-left">Facility</th>
                  <th className="table-header px-3 py-2 text-left">S/N</th>
                  <th className="table-header px-3 py-2 text-left">Contact</th>
                  <th className="table-header px-3 py-2 text-left">Sale Type</th>
                  <th className="table-header px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.slice(0, 20).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-800/30">
                    <td className="table-cell">{row.subcategoryName}</td>
                    <td className="table-cell max-w-[150px] truncate">{row.facility_name}</td>
                    <td className="table-cell font-mono">{row.serial_number ?? '—'}</td>
                    <td className="table-cell">{row.facility_contact_name ?? '—'}</td>
                    <td className="table-cell">
                      <SaleTypeBadge saleType={row.sale_type} />
                    </td>
                    <td className="table-cell">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && (
              <p className="text-xs text-slate-500 text-center p-2">...and {rows.length - 20} more rows</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setRows([])} className="btn-secondary text-sm">
              <X size={14} /> Clear
            </button>
            <button
              onClick={handleImport}
              disabled={importing || rows.length === 0}
              className="btn-primary text-sm"
            >
              {importing ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importing {rows.length} rows...
                </span>
              ) : <><Upload size={14} /> Import {rows.length} Equipment</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
