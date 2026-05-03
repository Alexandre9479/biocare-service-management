// ============================================================
// ENUMS / LITERAL TYPES
// ============================================================

export type UserRole = 'admin' | 'engineer'
export type AvailabilityStatus = 'available' | 'on_service' | 'on_leave' | 'unavailable'
export type SaleType = 'cash' | 'placement' | 'hire_purchase'
export type EquipmentStatus = 'active' | 'inactive' | 'decommissioned'
export type ServiceType = 'preventive' | 'corrective' | 'installation' | 'calibration' | 'emergency'
export type AssignmentStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type PaymentStatus = 'pending' | 'paid' | 'waived'
export type HPPaymentStatus = 'active' | 'completed' | 'defaulted'
export type ImageType = 'before' | 'during' | 'after' | 'other'
export type NotificationType =
  | 'service_due'
  | 'assignment'
  | 'overdue'
  | 'completion'
  | 'reassignment'
  | 'system'

// ============================================================
// CORE ENTITIES
// ============================================================

export interface Profile {
  id: string
  name: string
  email: string
  role: UserRole
  phone?: string
  specializations: string[]
  availability_status: AvailabilityStatus
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  description?: string
  is_active: boolean
  created_at: string
  subcategories?: Subcategory[]
}

export interface Subcategory {
  id: string
  category_id: string
  name: string
  manufacturer?: string
  description?: string
  is_active: boolean
  created_at: string
  category?: Category
}

export interface Region {
  id: string
  name: string
  description?: string
  counties: string[]
  is_active: boolean
  created_at: string
}

export interface Equipment {
  id: string
  serial_number: string
  category_id?: string
  subcategory_id?: string
  facility_name: string
  facility_contact_name?: string
  facility_contact_phone?: string
  facility_contact_email?: string
  facility_address?: string
  region_id?: string
  county?: string
  installation_date?: string
  last_service_date?: string
  next_service_date?: string
  service_interval_days: number
  status: EquipmentStatus
  sale_type: SaleType
  warranty_expiry_date?: string
  notes?: string
  // Hire Purchase
  hp_total_price?: number
  hp_down_payment?: number
  hp_installment_amount?: number
  hp_installment_frequency?: string
  hp_total_installments?: number
  hp_installments_paid?: number
  hp_payment_status?: HPPaymentStatus
  hp_final_payment_date?: string
  // Metadata
  created_at: string
  updated_at: string
  created_by?: string
  // Relations
  category?: Category
  subcategory?: Subcategory
  region?: Region
}

export interface ServiceAssignment {
  id: string
  equipment_id: string
  engineer_id?: string
  scheduled_date?: string
  service_type?: ServiceType
  status: AssignmentStatus
  special_instructions?: string
  priority: Priority
  assigned_by?: string
  assigned_at?: string
  acknowledged_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
  // Relations
  equipment?: Equipment
  engineer?: Profile
  assigned_by_profile?: Profile
}

export interface ServicePart {
  id: string
  service_log_id: string
  part_name: string
  part_number?: string
  quantity: number
  unit_cost: number
  total_cost: number
  is_chargeable: boolean
  created_at: string
}

export interface ServiceImage {
  id: string
  service_log_id: string
  image_url: string
  caption?: string
  image_type: ImageType
  file_name?: string
  file_size?: number
  created_at: string
}

export interface ServiceLog {
  id: string
  assignment_id?: string
  equipment_id: string
  engineer_id: string
  service_date: string
  service_type?: ServiceType
  findings?: string
  actions_taken?: string
  service_duration_hours?: number
  next_recommended_date?: string
  service_charge: number
  parts_charge: number
  total_charge: number
  charge_status?: string
  payment_status: PaymentStatus
  client_feedback?: string
  client_name?: string
  engineer_signature?: string
  client_signature?: string
  created_at: string
  updated_at: string
  // Relations
  equipment?: Equipment
  engineer?: Profile
  parts?: ServicePart[]
  images?: ServiceImage[]
  assignment?: ServiceAssignment
}

export interface Notification {
  id: string
  recipient_id: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
  is_read: boolean
  priority: Priority
  created_at: string
}

export interface ServiceRate {
  id: string
  category_id?: string
  service_type?: string
  rate: number
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  category?: Category
}

// ============================================================
// DASHBOARD & ANALYTICS TYPES
// ============================================================

export interface AdminDashboardStats {
  totalEquipment: number
  bySaleType: {
    cash: number
    placement: number
    hire_purchase: number
  }
  pendingAssignments: number
  upcomingServices: number
  overdueServices: number
  completedThisMonth: number
  revenueThisMonth: number
  activeEngineers: number
}

export interface EngineerDashboardStats {
  myAssignments: number
  todayAssignments: number
  completedThisMonth: number
  upcomingThisWeek: number
}

export interface RegionStats {
  region_id: string
  region_name: string
  equipment_count: number
  overdue_count: number
  services_this_month: number
}

// ============================================================
// EXCEL IMPORT TYPES
// ============================================================

export interface ExcelEquipmentRow {
  subcategoryName: string
  facility_name: string
  facility_contact_email?: string
  facility_contact_phone?: string
  facility_contact_name?: string
  serial_number?: string
  status: EquipmentStatus
  sale_type: SaleType
  rowIndex: number
  sheetName: string
}

export interface ImportError {
  row: number
  sheet: string
  field: string
  message: string
}

export interface ImportResult {
  success: number
  errors: number
  errorDetails: ImportError[]
  importedRows: ExcelEquipmentRow[]
}

// ============================================================
// FORM TYPES
// ============================================================

export interface EquipmentFormData {
  serial_number: string
  category_id: string
  subcategory_id: string
  facility_name: string
  facility_contact_name: string
  facility_contact_phone: string
  facility_contact_email: string
  facility_address: string
  region_id: string
  county: string
  installation_date: string
  service_interval_days: number
  status: EquipmentStatus
  sale_type: SaleType
  warranty_expiry_date: string
  notes: string
  // HP fields
  hp_total_price?: number
  hp_down_payment?: number
  hp_installment_amount?: number
  hp_installment_frequency?: string
  hp_total_installments?: number
  hp_installments_paid?: number
  hp_payment_status?: HPPaymentStatus
  hp_final_payment_date?: string
}

export interface ServiceLogFormData {
  service_date: string
  service_type: ServiceType
  findings: string
  actions_taken: string
  service_duration_hours: number
  next_recommended_date: string
  client_name: string
  client_feedback: string
  parts: {
    part_name: string
    part_number: string
    quantity: number
    unit_cost: number
    is_chargeable: boolean
  }[]
}

export interface AssignEngineerFormData {
  engineer_id: string
  scheduled_date: string
  service_type: ServiceType
  special_instructions: string
  priority: Priority
}
