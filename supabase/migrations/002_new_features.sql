-- ============================================================
-- MIGRATION 002: Parts Inventory, System Settings, Warranty Alerts
-- Run this in Supabase SQL Editor AFTER schema.sql
-- ============================================================

-- ── SYSTEM SETTINGS TABLE ────────────────────────────────────────────────────
-- Stores configurable system settings (WhatsApp credentials, etc.)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  is_sensitive BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed default WhatsApp settings (blank until admin fills them)
INSERT INTO public.system_settings (key, value, description, is_sensitive) VALUES
  ('whatsapp_phone_number_id',  '',  'Meta WhatsApp Business Cloud API – Phone Number ID', FALSE),
  ('whatsapp_access_token',     '',  'Meta WhatsApp Business Cloud API – Permanent Access Token', TRUE),
  ('whatsapp_enabled',          'false', 'Enable WhatsApp notifications', FALSE),
  ('whatsapp_api_version',      'v21.0', 'Meta Graph API version', FALSE)
ON CONFLICT (key) DO NOTHING;

-- ── PARTS INVENTORY TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parts_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_name TEXT NOT NULL,
  part_number TEXT,
  description TEXT,
  category_id UUID REFERENCES public.categories(id),    -- which equipment category it's for
  subcategory_id UUID REFERENCES public.subcategories(id),
  quantity_in_stock INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 5,             -- alert when stock falls below this
  unit_cost DECIMAL(10, 2) DEFAULT 0,
  supplier_name TEXT,
  supplier_contact TEXT,
  location TEXT,                                        -- where it's stored in the office
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parts_inventory_active ON public.parts_inventory(is_active);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_stock ON public.parts_inventory(quantity_in_stock);

ALTER TABLE public.parts_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view parts" ON public.parts_inventory
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage parts inventory" ON public.parts_inventory
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER set_updated_at_parts_inventory
  BEFORE UPDATE ON public.parts_inventory
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── PARTS INVENTORY MOVEMENTS ────────────────────────────────────────────────
-- Tracks every stock in/out movement
CREATE TABLE IF NOT EXISTS public.parts_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID REFERENCES public.parts_inventory(id) ON DELETE CASCADE NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('stock_in', 'stock_out', 'adjustment', 'return')),
  quantity INTEGER NOT NULL,
  reference_type TEXT,          -- 'service_log', 'purchase', 'adjustment'
  reference_id UUID,            -- service_log.id or purchase order id
  notes TEXT,
  performed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.parts_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can view movements" ON public.parts_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create movements" ON public.parts_movements
  FOR INSERT TO authenticated WITH CHECK (TRUE);

-- ── WHATSAPP LOG TABLE ────────────────────────────────────────────────────────
-- Tracks sent WhatsApp messages for audit purposes
CREATE TABLE IF NOT EXISTS public.whatsapp_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  message_type TEXT,      -- 'assignment', 'reminder', 'warranty_alert', etc.
  message_body TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  meta_message_id TEXT,   -- message ID returned by Meta API
  error_details TEXT,
  sent_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.whatsapp_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view WhatsApp log" ON public.whatsapp_log
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Authenticated can log WhatsApp messages" ON public.whatsapp_log
  FOR INSERT TO authenticated WITH CHECK (TRUE);
