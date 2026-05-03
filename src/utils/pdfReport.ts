import jsPDF from 'jspdf'
import { formatDate, formatCurrency, getServiceTypeLabel } from './helpers'

interface ReportData {
  equipment: {
    serial_number: string
    facility_name: string
    facility_contact_name?: string
    facility_contact_phone?: string
    facility_address?: string
    sale_type: string
    status: string
    subcategory?: { name: string }
    region?: { name: string }
    category?: { name: string }
  }
  log: {
    id: string
    service_date: string
    service_type?: string
    findings?: string
    actions_taken?: string
    service_duration_hours?: number
    next_recommended_date?: string
    service_charge: number
    parts_charge: number
    total_charge: number
    charge_status?: string
    payment_status: string
    client_name?: string
    client_feedback?: string
  }
  engineer: { name: string; phone?: string; email?: string }
  parts: { part_name: string; part_number?: string; quantity: number; unit_cost: number; total_cost: number }[]
  images?: { image_url: string; image_type: string; caption?: string }[]
}

const BRAND_PURPLE = [123, 45, 139] as [number, number, number]
const BRAND_CYAN   = [0, 172, 193]  as [number, number, number]
const BRAND_RED    = [211, 47, 47]  as [number, number, number]
const DARK        = [15, 23, 42]    as [number, number, number]
const GRAY        = [100, 116, 139] as [number, number, number]
const LIGHT_GRAY  = [241, 245, 249] as [number, number, number]

// Load an image URL as base64 for jsPDF
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function generateServiceReport(data: ReportData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 14
  let y = 0

  // Load real logo
  const logoBase64 = await loadImageAsBase64('/biocare-logo.png')

  // ── Header band ──────────────────────────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 0, W, 42, 'F')

  doc.setFillColor(...BRAND_RED)
  doc.rect(0, 42, W, 1.5, 'F')
  doc.setFillColor(...BRAND_PURPLE)
  doc.rect(0, 43.5, W, 1, 'F')

  // Real logo on dark background (white version would be ideal but we scale down the coloured one)
  if (logoBase64) {
    // Place logo in header on a white pill background
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(M, 5, 80, 14, 2, 2, 'F')
    doc.addImage(logoBase64, 'PNG', M + 1, 6, 78, 12)
  } else {
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('BIOCARE', M, 16)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...BRAND_CYAN)
    doc.text('HEALTH SYSTEMS', M, 22)
  }

  doc.setTextColor(180, 180, 180)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('biocarehealthsystems@gmail.com', M, 36)

  // Report title top-right
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('SERVICE REPORT', W - M, 18, { align: 'right' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text(`Date: ${formatDate(data.log.service_date)}`, W - M, 26, { align: 'right' })
  doc.text(`Ref: SVC-${data.log.id.slice(0, 8).toUpperCase()}`, W - M, 32, { align: 'right' })

  y = 52

  // ── Charge status banner ──────────────────────────────────────────────────
  const isChargeable = data.log.total_charge > 0
  doc.setFillColor(...(isChargeable ? [254, 243, 199] as [number,number,number] : [220, 252, 231] as [number,number,number]))
  doc.roundedRect(M, y, W - M * 2, 10, 2, 2, 'F')
  doc.setTextColor(...(isChargeable ? [146, 64, 14] as [number,number,number] : [21, 128, 61] as [number,number,number]))
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(data.log.charge_status ?? (isChargeable ? 'CHARGEABLE SERVICE' : 'FREE SERVICE'), M + 5, y + 6.5)
  if (isChargeable) {
    doc.text(formatCurrency(data.log.total_charge), W - M - 5, y + 6.5, { align: 'right' })
  }
  y += 16

  // ── Two-column: Equipment + Facility ──────────────────────────────────────
  const colW = (W - M * 2 - 6) / 2

  const drawBox = (title: string, rows: [string, string][], x: number, startY: number, w: number): number => {
    doc.setFillColor(...LIGHT_GRAY)
    doc.roundedRect(x, startY, w, 7, 1, 1, 'F')
    doc.setTextColor(...BRAND_PURPLE)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(title, x + 3, startY + 5)
    let ry = startY + 10
    rows.forEach(([label, value]) => {
      doc.setTextColor(...GRAY)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(label + ':', x + 3, ry)
      doc.setTextColor(...DARK)
      doc.setFont('helvetica', 'bold')
      const lines = doc.splitTextToSize(value || '—', w - 35)
      doc.text(lines, x + 32, ry)
      ry += lines.length * 4.5 + 1
    })
    return ry + 2
  }

  const eqRows: [string, string][] = [
    ['Category',   data.equipment.category?.name ?? '—'],
    ['Model',      data.equipment.subcategory?.name ?? '—'],
    ['Serial No',  data.equipment.serial_number],
    ['Status',     data.equipment.status],
    ['Sale Type',  data.equipment.sale_type.replace('_', ' ').toUpperCase()],
    ['Region',     data.equipment.region?.name ?? '—'],
  ]
  const facRows: [string, string][] = [
    ['Facility',   data.equipment.facility_name],
    ['Contact',    data.equipment.facility_contact_name ?? '—'],
    ['Phone',      data.equipment.facility_contact_phone ?? '—'],
    ['Address',    data.equipment.facility_address ?? '—'],
  ]

  const yAfterLeft  = drawBox('EQUIPMENT', eqRows, M, y, colW)
  const yAfterRight = drawBox('FACILITY', facRows, M + colW + 6, y, colW)
  y = Math.max(yAfterLeft, yAfterRight) + 2

  // ── Service Details ───────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT_GRAY)
  doc.roundedRect(M, y, W - M * 2, 7, 1, 1, 'F')
  doc.setTextColor(...BRAND_PURPLE)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('SERVICE DETAILS', M + 3, y + 5)
  y += 10

  const svcMeta: [string, string][] = [
    ['Service Date', formatDate(data.log.service_date)],
    ['Service Type', getServiceTypeLabel(data.log.service_type ?? '')],
    ['Duration',     data.log.service_duration_hours ? `${data.log.service_duration_hours} hrs` : '—'],
    ['Next Service', formatDate(data.log.next_recommended_date)],
    ['Engineer',     data.engineer.name],
  ]
  // Two-column meta
  const halfW = (W - M * 2 - 6) / 2
  svcMeta.forEach(([label, value], i) => {
    const x = M + (i % 2) * (halfW + 6)
    if (i % 2 === 0 && i > 0) y += 6
    else if (i === 0) {}
    doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    doc.text(label + ':', x, y)
    doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold')
    doc.text(value, x + 32, y)
    if (i % 2 === 1) y += 6
  })
  y += 8

  const printTextBlock = (label: string, content?: string) => {
    if (!content) return
    doc.setFillColor(...LIGHT_GRAY)
    doc.roundedRect(M, y, W - M * 2, 6, 1, 1, 'F')
    doc.setTextColor(...BRAND_PURPLE); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.text(label, M + 3, y + 4.5)
    y += 8
    doc.setTextColor(...DARK); doc.setFontSize(8); doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(content, W - M * 2 - 4)
    doc.text(lines, M + 2, y)
    y += lines.length * 4.5 + 4
  }

  printTextBlock('FINDINGS', data.log.findings)
  printTextBlock('ACTIONS TAKEN', data.log.actions_taken)

  // ── Parts table ───────────────────────────────────────────────────────────
  if (data.parts.length > 0) {
    doc.setFillColor(...LIGHT_GRAY)
    doc.roundedRect(M, y, W - M * 2, 6, 1, 1, 'F')
    doc.setTextColor(...BRAND_PURPLE); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
    doc.text('PARTS USED', M + 3, y + 4.5)
    y += 8

    // Table headers
    doc.setFillColor(...BRAND_PURPLE)
    doc.rect(M, y, W - M * 2, 6, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'bold')
    doc.text('Part Name', M + 2, y + 4)
    doc.text('Part No.', M + 70, y + 4)
    doc.text('Qty', M + 100, y + 4)
    doc.text('Unit Cost', M + 120, y + 4)
    doc.text('Total', W - M - 2, y + 4, { align: 'right' })
    y += 7

    data.parts.forEach((part, i) => {
      if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(M, y - 1, W - M * 2, 6, 'F') }
      doc.setTextColor(...DARK); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
      doc.text(part.part_name.slice(0, 30), M + 2, y + 3.5)
      doc.text(part.part_number?.slice(0, 15) ?? '—', M + 70, y + 3.5)
      doc.text(String(part.quantity), M + 100, y + 3.5)
      doc.text(formatCurrency(part.unit_cost), M + 120, y + 3.5)
      doc.text(formatCurrency(part.total_cost), W - M - 2, y + 3.5, { align: 'right' })
      y += 6
    })
    y += 4
  }

  // ── Charges summary ───────────────────────────────────────────────────────
  if (isChargeable) {
    doc.setFillColor(...LIGHT_GRAY)
    doc.roundedRect(M + colW + 6, y, colW, 28, 2, 2, 'F')
    const cx = M + colW + 9
    doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
    doc.text('Service Fee:', cx, y + 7);  doc.setTextColor(...DARK); doc.text(formatCurrency(data.log.service_charge), cx + colW - 9, y + 7, { align: 'right' })
    doc.setTextColor(...GRAY); doc.text('Parts:', cx, y + 13); doc.setTextColor(...DARK); doc.text(formatCurrency(data.log.parts_charge), cx + colW - 9, y + 13, { align: 'right' })
    doc.setDrawColor(...GRAY); doc.line(cx, y + 16, cx + colW - 6, y + 16)
    doc.setTextColor(...BRAND_PURPLE); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
    doc.text('TOTAL:', cx, y + 22); doc.text(formatCurrency(data.log.total_charge), cx + colW - 9, y + 22, { align: 'right' })
    doc.setTextColor(...(data.log.payment_status === 'paid' ? [21, 128, 61] as [number,number,number] : [146, 64, 14] as [number,number,number]))
    doc.setFontSize(7); doc.text(`Status: ${data.log.payment_status.toUpperCase()}`, cx, y + 26.5)
    y += 34
  }

  // ── Client feedback ───────────────────────────────────────────────────────
  printTextBlock('CLIENT FEEDBACK', data.log.client_feedback)

  // ── Signature blocks ──────────────────────────────────────────────────────
  if (y > 240) { doc.addPage(); y = 20 }
  y = Math.max(y, 220)

  doc.setDrawColor(...GRAY)
  const sigW = (W - M * 2 - 10) / 2
  doc.line(M, y + 15, M + sigW, y + 15)
  doc.line(M + sigW + 10, y + 15, M + sigW * 2 + 10, y + 15)

  doc.setTextColor(...GRAY); doc.setFontSize(7); doc.setFont('helvetica', 'normal')
  doc.text('Engineer Signature', M, y + 19)
  doc.text(data.engineer.name, M, y + 23)
  doc.text('Client / Authorised Representative', M + sigW + 10, y + 19)
  doc.text(data.log.client_name ?? '', M + sigW + 10, y + 23)

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK)
  doc.rect(0, 282, W, 15, 'F')
  doc.setTextColor(120, 120, 120); doc.setFontSize(6.5)
  doc.text('Biocare Health Systems Ltd  |  biocarehealthsystems@gmail.com  |  Kenya', W / 2, 289, { align: 'center' })
  doc.setTextColor(...BRAND_CYAN)
  doc.text('Suppliers of Laboratory Diagnostics and Equipment, Hospital Equipment & Surgical', W / 2, 293, { align: 'center' })

  const filename = `Biocare_Service_Report_${data.equipment.serial_number}_${data.log.service_date}.pdf`
  doc.save(filename)
}
