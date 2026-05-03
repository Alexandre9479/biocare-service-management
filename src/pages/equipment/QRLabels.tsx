import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { ArrowLeft, Printer, Download, QrCode, Search, Info, CheckSquare, Square } from 'lucide-react'
import supabase from '@/lib/supabase'
import { PageSpinner } from '@/components/ui/Spinner'
import SaleTypeBadge from '@/components/equipment/SaleTypeBadge'
import toast from 'react-hot-toast'

// ── Generate a QR data-URL (not canvas — more reliable for printing) ─────────
async function makeQR(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 200,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })
}

// ── Sale type helpers ────────────────────────────────────────────────────────
function saleInfo(type: string) {
  if (type === 'cash')          return { label: 'CASH SALE',     bg: '#16a34a' }
  if (type === 'placement')     return { label: 'PLACEMENT',     bg: '#ea580c' }
  return                               { label: 'HIRE PURCHASE', bg: '#2563eb' }
}

// ── Build the HTML for the print window ──────────────────────────────────────
async function buildPrintHTML(
  items: any[],
  logoDataUrl: string,
  baseUrl: string,
): Promise<string> {
  // Generate all QR codes in parallel
  const qrUrls = await Promise.all(
    items.map(e => makeQR(`${baseUrl}/equipment/${e.id}`))
  )

  const stickersHtml = items.map((e, i) => {
    const sale = saleInfo(e.sale_type)
    const sn   = e.serial_number ?? 'N/A'
    const model = e.subcategory?.name ?? '—'
    // Truncate long facility names
    const name = e.facility_name.length > 35
      ? e.facility_name.slice(0, 33) + '…'
      : e.facility_name

    return `
      <div class="sticker">
        <img class="logo" src="${logoDataUrl}" alt="Biocare Health Systems" />
        <div class="divider-red"></div>
        <img class="qr" src="${qrUrls[i]}" alt="QR Code" />
        <div class="info">
          <div class="facility">${name}</div>
          <div class="model">${model}</div>
          <div class="sn-box"><span class="sn">S/N: ${sn}</span></div>
          <div class="sale-badge" style="background:${sale.bg}">● ${sale.label}</div>
        </div>
        <div class="footer-line"></div>
        <div class="footer-text">📱 Scan to view service record</div>
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Biocare QR Stickers</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: white;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      padding: 10mm;
      display: flex;
      flex-wrap: wrap;
      gap: 4mm;
      align-content: flex-start;
    }

    .sticker {
      width: 60mm;
      height: 75mm;
      border: 0.4mm solid #cbd5e1;
      border-radius: 2mm;
      background: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2mm 2mm 1.5mm;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
    }

    .logo {
      width: 100%;
      height: 11mm;
      object-fit: contain;
      object-position: center;
      margin-bottom: 1mm;
    }

    .divider-red {
      width: 100%;
      height: 0.5mm;
      background: #dc2626;
      margin-bottom: 1.5mm;
      flex-shrink: 0;
    }

    .qr {
      width: 29mm;
      height: 29mm;
      display: block;
      flex-shrink: 0;
    }

    .info {
      width: 100%;
      text-align: center;
      margin-top: 1.5mm;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.8mm;
    }

    .facility {
      font-size: 7.5pt;
      font-weight: bold;
      color: #0f172a;
      line-height: 1.25;
      max-height: 2.5em;
      overflow: hidden;
    }

    .model {
      font-size: 6.5pt;
      font-weight: 600;
      color: #475569;
    }

    .sn-box {
      background: #f8fafc;
      border: 0.3mm solid #e2e8f0;
      border-radius: 1mm;
      padding: 0.4mm 2mm;
      width: 100%;
    }

    .sn {
      font-size: 6pt;
      font-family: 'Courier New', monospace;
      font-weight: bold;
      color: #1e293b;
    }

    .sale-badge {
      color: white;
      font-size: 5.5pt;
      font-weight: bold;
      padding: 0.5mm 2.5mm;
      border-radius: 3mm;
      letter-spacing: 0.02em;
    }

    .footer-line {
      width: 100%;
      height: 0.3mm;
      background: #e2e8f0;
      margin-top: auto;
      margin-bottom: 1mm;
    }

    .footer-text {
      font-size: 5pt;
      color: #94a3b8;
      white-space: nowrap;
    }

    @media print {
      body { background: white; }
      .page { padding: 5mm; }
      @page { size: A4 portrait; margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="page">
    ${stickersHtml}
  </div>
  <script>
    // Auto-print after images load
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
        // Close after print dialog dismissed
        window.addEventListener('afterprint', function() { window.close(); });
      }, 800);
    });
  </script>
</body>
</html>`
}

// ── Preview sticker (screen only — no canvas to avoid async issues) ──────────
function PreviewSticker({ equipment: e, qrDataUrl }: { equipment: any; qrDataUrl: string }) {
  const sale = saleInfo(e.sale_type)
  return (
    <div style={{
      width: 174, height: 213,    // 60mm × 75mm at 96dpi (approx screen size)
      backgroundColor: '#ffffff',
      border: '1.5px solid #cbd5e1',
      borderRadius: 6,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 6,
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      flexShrink: 0,
    }}>
      <img src="/biocare-logo.png" alt="Biocare" style={{ width: '100%', height: 30, objectFit: 'contain', marginBottom: 3 }} />
      <div style={{ width: '100%', height: 1.5, background: '#dc2626', marginBottom: 4 }} />
      {qrDataUrl
        ? <img src={qrDataUrl} alt="QR" style={{ width: 82, height: 82 }} />
        : <div style={{ width: 82, height: 82, background: '#f1f5f9', borderRadius: 4 }} />
      }
      <div style={{ width: '100%', textAlign: 'center', marginTop: 4, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <p style={{ fontSize: 9, fontWeight: 'bold', color: '#0f172a', lineHeight: 1.3, margin: 0,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {e.facility_name}
        </p>
        <p style={{ fontSize: 8, color: '#475569', margin: 0, fontWeight: 600 }}>{e.subcategory?.name ?? '—'}</p>
        <div style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0', borderRadius: 3, padding: '1px 6px', width: '100%', textAlign: 'center' }}>
          <span style={{ fontSize: 7, fontFamily: 'monospace', color: '#1e293b', fontWeight: 'bold' }}>S/N: {e.serial_number ?? 'N/A'}</span>
        </div>
        <div style={{ background: sale.bg, color: '#fff', fontSize: 6.5, fontWeight: 'bold', padding: '1.5px 6px', borderRadius: 10 }}>
          ● {sale.label}
        </div>
      </div>
      <div style={{ width: '100%', height: 0.5, background: '#e2e8f0', marginTop: 'auto', marginBottom: 3 }} />
      <p style={{ fontSize: 6, color: '#94a3b8', margin: 0 }}>📱 Scan to view service record</p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function QRLabels() {
  const navigate = useNavigate()
  const { id: paramId } = useParams()
  const [selected, setSelected] = useState<Set<string>>(new Set(paramId ? [paramId] : []))
  const [search, setSearch] = useState('')
  const [previewQRs, setPreviewQRs] = useState<Record<string, string>>({})
  const [printing, setPrinting] = useState(false)

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ['equipment-qr'],
    queryFn: async () => {
      const { data } = await supabase
        .from('equipment')
        .select('id, serial_number, facility_name, sale_type, subcategory_id')
        .order('facility_name')
      if (!data?.length) return []
      const subIds = [...new Set(data.map(e => e.subcategory_id).filter(Boolean))]
      const { data: subs } = subIds.length
        ? await supabase.from('subcategories').select('id, name').in('id', subIds)
        : { data: [] }
      return data.map(e => ({ ...e, subcategory: subs?.find((s: any) => s.id === e.subcategory_id) }))
    },
  })

  // Generate preview QR codes whenever selection changes
  useEffect(() => {
    const base = window.location.origin
    selected.forEach(async id => {
      if (previewQRs[id]) return
      const url = await makeQR(`${base}/equipment/${id}`)
      setPreviewQRs(p => ({ ...p, [id]: url }))
    })
  }, [selected]) // eslint-disable-line

  const filtered = equipment.filter((e: any) => {
    if (!search) return true
    const s = search.toLowerCase()
    return e.facility_name?.toLowerCase().includes(s) || e.serial_number?.toLowerCase().includes(s)
  })

  const allSelected = filtered.length > 0 && filtered.every((e: any) => selected.has(e.id))
  const toggleOne = (id: string) =>
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => {
    if (allSelected) setSelected(s => { const n = new Set(s); filtered.forEach((e: any) => n.delete(e.id)); return n })
    else setSelected(s => { const n = new Set(s); filtered.forEach((e: any) => n.add(e.id)); return n })
  }

  const selectedList = equipment.filter((e: any) => selected.has(e.id))

  // Download single QR
  const downloadSingle = async (e: any) => {
    const url = await makeQR(`${window.location.origin}/equipment/${e.id}`)
    const a = document.createElement('a')
    a.download = `QR_${e.serial_number || e.id}.png`
    a.href = url
    a.click()
  }

  // Print via new clean window
  const handlePrint = useCallback(async () => {
    if (!selectedList.length) return
    setPrinting(true)
    try {
      // Load logo as base64 so it works in the isolated print window
      const logoRes  = await fetch('/biocare-logo.png')
      const logoBlob = await logoRes.blob()
      const logoDataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result as string)
        r.onerror = rej
        r.readAsDataURL(logoBlob)
      })

      const html = await buildPrintHTML(selectedList, logoDataUrl, window.location.origin)

      const printWin = window.open('', '_blank', 'width=900,height=700,toolbar=0,menubar=0,scrollbars=1')
      if (!printWin) { toast.error('Pop-up blocked. Please allow pop-ups for this site.'); return }

      printWin.document.open()
      printWin.document.write(html)
      printWin.document.close()
    } catch (err: any) {
      toast.error('Print failed: ' + (err?.message ?? 'Unknown error'))
    } finally {
      setPrinting(false)
    }
  }, [selectedList])

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate(-1)} className="btn-secondary h-9 w-9 p-0 justify-center">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="page-title flex items-center gap-2">
            <QrCode size={22} className="text-biocare-cyan-400" /> QR Code Stickers
          </h1>
          <p className="text-slate-500 text-sm">
            Select machines → preview stickers → click Print → a clean print window opens
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="card p-4 bg-biocare-cyan-500/5 border border-biocare-cyan-500/20">
        <div className="flex items-start gap-3">
          <Info size={15} className="text-biocare-cyan-400 flex-shrink-0 mt-0.5" />
          <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
            <li>Tick the machines you want stickers for</li>
            <li>A preview of each sticker appears on the right (exactly as it will print)</li>
            <li>Click <span className="text-slate-300 font-semibold">Print Stickers</span> — a clean new window opens with just the labels, then prints automatically</li>
            <li>Cut out each sticker and stick it on the physical machine at the hospital</li>
            <li>Engineer scans with phone camera → opens that machine's service record instantly, no typing needed</li>
          </ol>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Equipment picker */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-200">Select Machines ({selected.size} selected)</p>
              <button onClick={toggleAll} className="btn-secondary text-xs h-8 px-3 flex items-center gap-1.5">
                {allSelected ? <><CheckSquare size={13} /> Deselect All</> : <><Square size={13} /> Select All</>}
              </button>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search facility or serial number…" className="input-field pl-9 text-sm h-8" />
            </div>
          </div>

          <div className="divide-y divide-slate-800 max-h-[560px] overflow-y-auto">
            {filtered.map((e: any) => (
              <div key={e.id} onClick={() => toggleOne(e.id)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-slate-800/30 transition-colors ${selected.has(e.id) ? 'bg-biocare-purple-500/10' : ''}`}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  selected.has(e.id) ? 'bg-biocare-purple-500 border-biocare-purple-500' : 'border-slate-600'}`}>
                  {selected.has(e.id) && (
                    <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="2,6 5,9 10,3" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{e.facility_name}</p>
                  <p className="text-xs text-slate-500">{e.subcategory?.name ?? '—'} · S/N: <span className="font-mono">{e.serial_number ?? 'N/A'}</span></p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <SaleTypeBadge saleType={e.sale_type} />
                  <button onClick={ev => { ev.stopPropagation(); downloadSingle(e) }}
                    className="p-1.5 text-slate-500 hover:text-biocare-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Download QR as PNG">
                    <Download size={13} />
                  </button>
                </div>
              </div>
            ))}
            {!filtered.length && <div className="p-8 text-center text-slate-500 text-sm">No equipment found</div>}
          </div>
        </div>

        {/* Right: Preview + print button */}
        <div className="card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">
              Preview {selected.size > 0 ? `(${selected.size} sticker${selected.size > 1 ? 's' : ''})` : ''}
            </p>
            <button
              onClick={handlePrint}
              disabled={!selected.size || printing}
              className="btn-primary text-sm"
            >
              {printing ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Preparing…
                </span>
              ) : (
                <><Printer size={15} /> Print {selected.size > 0 ? `${selected.size} Sticker${selected.size > 1 ? 's' : ''}` : 'Stickers'}</>
              )}
            </button>
          </div>

          {!selected.size ? (
            <div className="flex flex-col items-center justify-center flex-1 min-h-[300px] text-slate-600 gap-3">
              <QrCode size={40} className="text-slate-700" />
              <p className="text-sm text-center">Tick boxes on the left to see previews here</p>
            </div>
          ) : (
            <div className="bg-slate-800/30 rounded-xl p-4 overflow-y-auto max-h-[500px]">
              <div className="flex flex-wrap gap-4">
                {selectedList.map((e: any) => (
                  <PreviewSticker key={e.id} equipment={e} qrDataUrl={previewQRs[e.id] ?? ''} />
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-600">
            💡 Each sticker is 60 × 75 mm. When the print window opens, set scale to <strong className="text-slate-400">100%</strong> and disable <strong className="text-slate-400">"Fit to page"</strong>.
            If your browser blocks the pop-up, click <em>Allow</em> in the address bar.
          </p>
        </div>
      </div>
    </div>
  )
}
