import ExcelJS from 'exceljs'
import type { ExcelEquipmentRow, ImportResult, EquipmentStatus, SaleType } from '@/types'

// ── Cell value extractor (handles all ExcelJS cell types) ────────────────────
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString().split('T')[0]
  // Rich text: { richText: [{text: '...'}] }
  if (typeof v === 'object' && 'richText' in (v as any)) {
    return ((v as any).richText as any[]).map((r: any) => r.text ?? '').join('').trim()
  }
  // Formula cell: { formula: '...', result: ... }
  if (typeof v === 'object' && 'result' in (v as any)) {
    const r = (v as any).result
    return r !== null && r !== undefined ? String(r).trim() : ''
  }
  // Shared formula
  if (typeof v === 'object' && 'sharedFormula' in (v as any)) {
    const r = (v as any).result
    return r !== null && r !== undefined ? String(r).trim() : ''
  }
  return String(v).trim()
}

// ── Value normalisers ────────────────────────────────────────────────────────
function normaliseStatus(raw: string): EquipmentStatus {
  switch (raw.trim().toUpperCase()) {
    case 'ACTIVE':        return 'active'
    case 'INACTIVE':      return 'inactive'
    case 'DECOMMISSIONED':return 'decommissioned'
    default:              return 'active'
  }
}

function normaliseSaleType(raw: string): SaleType {
  const u = raw.trim().toUpperCase()
  if (u === 'PURCHASE' || u === 'CASH') return 'cash'
  if (u === 'PLACEMENT')                return 'placement'
  if (u.includes('HIRE'))               return 'hire_purchase'
  return 'cash'
}

// ── Header map (what column headers look like in the template) ───────────────
const HEADER_MAP: Record<string, string> = {
  'FACILITY':             'facility_name',
  'FACILITY NAME':        'facility_name',
  'EMAIL':                'facility_contact_email',
  'PHONE NO.':            'facility_contact_phone',
  'PHONE NO':             'facility_contact_phone',
  'PHONE NUMBER':         'facility_contact_phone',
  'PHONE':                'facility_contact_phone',
  'CONTACT PERSON':       'facility_contact_name',
  'CONTACT':              'facility_contact_name',
  'S/N':                  'serial_number',
  'SERIAL NO':            'serial_number',
  'SERIAL NO.':           'serial_number',
  'SERIAL NUMBER':        'serial_number',
  'SN':                   'serial_number',
  'STATUS':               'status',
  'MODE OF AQUISITION':   'sale_type',
  'MODE OF ACQUISITION':  'sale_type',
  'ACQUISITION':          'sale_type',
  'MODE':                 'sale_type',
  'TYPE':                 'sale_type',
}

/**
 * Parses ALL sheets of the Biocare equipment Excel template.
 *
 * Per-sheet structure (as confirmed from the template):
 *   Row 1  — Title row  (skip — may be merged)
 *   Row 2  — Headers:  FACILITY | EMAIL | PHONE NO. | CONTACT PERSON | S/N | STATUS | MODE OF AQUISITION
 *   Row 3+ — Data rows
 *
 * Sheet name = equipment model / subcategory (e.g. "DYMIND DH36").
 */
export async function parseEquipmentExcel(file: File): Promise<ExcelEquipmentRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const results: ExcelEquipmentRow[] = []

  workbook.eachSheet((worksheet) => {
    const sheetName = worksheet.name.trim()
    if (!sheetName) return

    // Collect ALL rows as flat string arrays, using row index as key
    // ExcelJS rows are 1-indexed; we use getRow(n) which always returns a row object
    const totalRows = worksheet.rowCount
    if (totalRows < 2) return // need at least header + 1 data row

    // Build rows array (0-indexed internally for convenience)
    const rows: string[][] = []
    for (let r = 1; r <= totalRows; r++) {
      const row = worksheet.getRow(r)
      const cells: string[] = []
      // Use worksheet.columnCount for column count; fall back to row.cellCount
      const colCount = Math.max(worksheet.columnCount ?? 0, row.cellCount ?? 0, 10)
      for (let c = 1; c <= colCount; c++) {
        cells.push(cellText(row.getCell(c)))
      }
      rows.push(cells)
    }

    // Find the header row: look for a row containing 'FACILITY' or 'S/N'
    // Usually row index 1 (0-based), but scan first 5 rows to be safe
    let headerRowIdx = -1
    const colMap: Record<number, string> = {}

    for (let i = 0; i < Math.min(rows.length, 6); i++) {
      const row = rows[i]
      const upperRow = row.map(c => c.toUpperCase())
      const hasFacility = upperRow.some(c => c === 'FACILITY' || c === 'FACILITY NAME')
      const hasSN = upperRow.some(c => c === 'S/N' || c === 'SERIAL NO' || c === 'SERIAL NO.' || c === 'SN')

      if (hasFacility || hasSN) {
        headerRowIdx = i
        // Build column map from this row
        upperRow.forEach((cell, idx) => {
          const matched = Object.keys(HEADER_MAP).find(k => k.toUpperCase() === cell)
          if (matched) colMap[idx] = HEADER_MAP[matched]
        })
        break
      }
    }

    if (headerRowIdx === -1) {
      // No recognisable header — try to guess by position (FACILITY=0, EMAIL=1, PHONE=2, CONTACT=3, S/N=4, STATUS=5, MODE=6)
      const defaults: Record<number, string> = {
        0: 'facility_name',
        1: 'facility_contact_email',
        2: 'facility_contact_phone',
        3: 'facility_contact_name',
        4: 'serial_number',
        5: 'status',
        6: 'sale_type',
      }
      Object.assign(colMap, defaults)
      headerRowIdx = 0 // treat row 0 as already skipped
    }

    // Data starts after the header row
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const dataRow = rows[i]
      if (dataRow.every(v => !v)) continue // skip blank rows

      const raw: Record<string, string> = {}
      Object.entries(colMap).forEach(([colIdxStr, field]) => {
        const val = dataRow[Number(colIdxStr)] ?? ''
        if (val) raw[field] = val
      })

      // Skip if no useful data
      if (!raw.facility_name && !raw.serial_number) continue

      results.push({
        subcategoryName: sheetName,
        sheetName,
        rowIndex: i + 1, // 1-based for error messages
        facility_name: raw.facility_name ?? '',
        facility_contact_email: raw.facility_contact_email || undefined,
        facility_contact_phone: raw.facility_contact_phone || undefined,
        facility_contact_name: raw.facility_contact_name || undefined,
        serial_number: raw.serial_number || undefined,
        status: normaliseStatus(raw.status ?? ''),
        sale_type: normaliseSaleType(raw.sale_type ?? ''),
      })
    }
  })

  return results
}

// ── Validation ───────────────────────────────────────────────────────────────
export function validateImportData(rows: ExcelEquipmentRow[]): ImportResult {
  const errorDetails: ImportResult['errorDetails'] = []
  let success = 0

  rows.forEach(row => {
    let valid = true
    if (!row.facility_name) {
      errorDetails.push({ row: row.rowIndex, sheet: row.sheetName, field: 'facility_name', message: 'Facility name is required' })
      valid = false
    }
    if (!row.subcategoryName) {
      errorDetails.push({ row: row.rowIndex, sheet: row.sheetName, field: 'subcategoryName', message: 'Equipment model (sheet name) missing' })
      valid = false
    }
    if (valid) success++
  })

  return { success, errors: errorDetails.length, errorDetails, importedRows: rows }
}

// ── Summary ──────────────────────────────────────────────────────────────────
export interface ImportSummary {
  totalRows: number
  bySheet: Record<string, number>
  bySaleType: { cash: number; placement: number; hire_purchase: number }
  byStatus: { active: number; inactive: number; decommissioned: number }
}

export function getImportSummary(rows: ExcelEquipmentRow[]): ImportSummary {
  const bySheet: Record<string, number> = {}
  const bySaleType = { cash: 0, placement: 0, hire_purchase: 0 }
  const byStatus = { active: 0, inactive: 0, decommissioned: 0 }

  for (const row of rows) {
    bySheet[row.sheetName] = (bySheet[row.sheetName] ?? 0) + 1
    bySaleType[row.sale_type]++
    byStatus[row.status]++
  }

  return { totalRows: rows.length, bySheet, bySaleType, byStatus }
}
