-- ============================================================
-- BIOCARE SERVICE MANAGEMENT SYSTEM - SUPABASE SCHEMA
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'engineer' CHECK (role IN ('admin', 'engineer')),
  phone TEXT,
  specializations TEXT[] DEFAULT '{}',
  availability_status TEXT NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available', 'on_service', 'on_leave', 'unavailable')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBCATEGORIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  manufacturer TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, name)
);

-- ============================================================
-- REGIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.regions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  counties TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EQUIPMENT TABLE (core table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  serial_number TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES public.categories(id),
  subcategory_id UUID REFERENCES public.subcategories(id),
  facility_name TEXT NOT NULL,
  facility_contact_name TEXT,
  facility_contact_phone TEXT,
  facility_contact_email TEXT,
  facility_address TEXT,
  region_id UUID REFERENCES public.regions(id),
  county TEXT,
  installation_date DATE,
  last_service_date DATE,
  next_service_date DATE,
  service_interval_days INTEGER DEFAULT 90,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'decommissioned')),
  sale_type TEXT NOT NULL CHECK (sale_type IN ('cash', 'placement', 'hire_purchase')),
  warranty_expiry_date DATE,
  notes TEXT,
  -- Hire Purchase fields
  hp_total_price DECIMAL(12, 2),
  hp_down_payment DECIMAL(12, 2),
  hp_installment_amount DECIMAL(12, 2),
  hp_installment_frequency TEXT,
  hp_total_installments INTEGER,
  hp_installments_paid INTEGER DEFAULT 0,
  hp_payment_status TEXT CHECK (hp_payment_status IN ('active', 'completed', 'defaulted')),
  hp_final_payment_date DATE,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- ============================================================
-- SERVICE ASSIGNMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID REFERENCES public.equipment(id) ON DELETE CASCADE NOT NULL,
  engineer_id UUID REFERENCES public.profiles(id),
  scheduled_date DATE,
  service_type TEXT CHECK (service_type IN ('preventive', 'corrective', 'installation', 'calibration', 'emergency')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  special_instructions TEXT,
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SERVICE LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES public.service_assignments(id),
  equipment_id UUID REFERENCES public.equipment(id) ON DELETE CASCADE NOT NULL,
  engineer_id UUID REFERENCES public.profiles(id) NOT NULL,
  service_date DATE NOT NULL,
  service_type TEXT CHECK (service_type IN ('preventive', 'corrective', 'installation', 'calibration', 'emergency')),
  findings TEXT,
  actions_taken TEXT,
  service_duration_hours DECIMAL(4, 2),
  next_recommended_date DATE,
  -- Charges
  service_charge DECIMAL(10, 2) DEFAULT 0,
  parts_charge DECIMAL(10, 2) DEFAULT 0,
  total_charge DECIMAL(10, 2) DEFAULT 0,
  charge_status TEXT,
  payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'waived')),
  -- Client info
  client_feedback TEXT,
  client_name TEXT,
  engineer_signature TEXT,
  client_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SERVICE PARTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_parts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_log_id UUID REFERENCES public.service_logs(id) ON DELETE CASCADE NOT NULL,
  part_name TEXT NOT NULL,
  part_number TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost DECIMAL(10, 2) DEFAULT 0,
  total_cost DECIMAL(10, 2) DEFAULT 0,
  is_chargeable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SERVICE IMAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_log_id UUID REFERENCES public.service_logs(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  image_type TEXT DEFAULT 'other'
    CHECK (image_type IN ('before', 'during', 'after', 'other')),
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SERVICE RATES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.categories(id),
  service_type TEXT,
  rate DECIMAL(10, 2) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_equipment_serial ON public.equipment(serial_number);
CREATE INDEX IF NOT EXISTS idx_equipment_region ON public.equipment(region_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON public.equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_sale_type ON public.equipment(sale_type);
CREATE INDEX IF NOT EXISTS idx_equipment_next_service ON public.equipment(next_service_date);
CREATE INDEX IF NOT EXISTS idx_service_assignments_engineer ON public.service_assignments(engineer_id);
CREATE INDEX IF NOT EXISTS idx_service_assignments_equipment ON public.service_assignments(equipment_id);
CREATE INDEX IF NOT EXISTS idx_service_assignments_status ON public.service_assignments(status);
CREATE INDEX IF NOT EXISTS idx_service_logs_equipment ON public.service_logs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_service_logs_engineer ON public.service_logs(engineer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'engineer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_equipment
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_service_assignments
  BEFORE UPDATE ON public.service_assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_service_logs
  BEFORE UPDATE ON public.service_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update equipment last_service_date and next_service_date after service log
CREATE OR REPLACE FUNCTION public.update_equipment_after_service()
RETURNS TRIGGER AS $$
DECLARE
  v_interval INTEGER;
BEGIN
  SELECT service_interval_days INTO v_interval
  FROM public.equipment
  WHERE id = NEW.equipment_id;

  UPDATE public.equipment
  SET
    last_service_date = NEW.service_date,
    next_service_date = COALESCE(
      NEW.next_recommended_date,
      NEW.service_date + INTERVAL '1 day' * COALESCE(v_interval, 90)
    )
  WHERE id = NEW.equipment_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_service_log_created
  AFTER INSERT ON public.service_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_equipment_after_service();

-- Update assignment status when service log is created
CREATE OR REPLACE FUNCTION public.update_assignment_on_log()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assignment_id IS NOT NULL THEN
    UPDATE public.service_assignments
    SET status = 'completed', completed_at = NOW()
    WHERE id = NEW.assignment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_service_log_complete_assignment
  AFTER INSERT ON public.service_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_assignment_on_log();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_rates ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- PROFILES policies
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_admin());

-- CATEGORIES policies
CREATE POLICY "Categories viewable by all authenticated" ON public.categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- SUBCATEGORIES policies
CREATE POLICY "Subcategories viewable by all authenticated" ON public.subcategories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage subcategories" ON public.subcategories
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- REGIONS policies
CREATE POLICY "Regions viewable by all authenticated" ON public.regions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage regions" ON public.regions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- EQUIPMENT policies
CREATE POLICY "Equipment viewable by all authenticated" ON public.equipment
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage equipment" ON public.equipment
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- SERVICE ASSIGNMENTS policies
CREATE POLICY "Admins see all assignments" ON public.service_assignments
  FOR SELECT TO authenticated
  USING (public.is_admin() OR engineer_id = auth.uid());
CREATE POLICY "Admins can create assignments" ON public.service_assignments
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update assignments" ON public.service_assignments
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR engineer_id = auth.uid());
CREATE POLICY "Admins can delete assignments" ON public.service_assignments
  FOR DELETE TO authenticated USING (public.is_admin());

-- SERVICE LOGS policies
CREATE POLICY "Admins see all logs, engineers see own" ON public.service_logs
  FOR SELECT TO authenticated
  USING (public.is_admin() OR engineer_id = auth.uid());
CREATE POLICY "Engineers can create logs for assigned services" ON public.service_logs
  FOR INSERT TO authenticated
  WITH CHECK (engineer_id = auth.uid() OR public.is_admin());
CREATE POLICY "Engineers can update own logs" ON public.service_logs
  FOR UPDATE TO authenticated
  USING (engineer_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins can delete logs" ON public.service_logs
  FOR DELETE TO authenticated USING (public.is_admin());

-- SERVICE PARTS policies
CREATE POLICY "Parts viewable by log owner and admins" ON public.service_parts
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.service_logs WHERE id = service_log_id AND engineer_id = auth.uid())
  );
CREATE POLICY "Engineers can manage their parts" ON public.service_parts
  FOR ALL TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.service_logs WHERE id = service_log_id AND engineer_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.service_logs WHERE id = service_log_id AND engineer_id = auth.uid())
  );

-- SERVICE IMAGES policies
CREATE POLICY "Images viewable by log owner and admins" ON public.service_images
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.service_logs WHERE id = service_log_id AND engineer_id = auth.uid())
  );
CREATE POLICY "Engineers can manage their images" ON public.service_images
  FOR ALL TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.service_logs WHERE id = service_log_id AND engineer_id = auth.uid())
  )
  WITH CHECK (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.service_logs WHERE id = service_log_id AND engineer_id = auth.uid())
  );

-- NOTIFICATIONS policies
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (recipient_id = auth.uid());

-- SERVICE RATES policies
CREATE POLICY "Rates viewable by all authenticated" ON public.service_rates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage rates" ON public.service_rates
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- STORAGE BUCKET FOR SERVICE IMAGES
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-images',
  'service-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-images');

CREATE POLICY "Images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'service-images');

CREATE POLICY "Engineers can update their images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'service-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Engineers can delete their images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'service-images' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));

-- ============================================================
-- SEED DATA
-- ============================================================

-- Kenya Regions
INSERT INTO public.regions (name, counties) VALUES
  ('Nairobi Region', ARRAY['Nairobi City']),
  ('Central Region', ARRAY['Kiambu', 'Muranga', 'Nyeri', 'Kirinyaga', 'Nyandarua', 'Thika']),
  ('Rift Valley Region', ARRAY['Nakuru', 'Eldoret', 'Kericho', 'Bomet', 'Nandi', 'Uasin Gishu', 'Elgeyo-Marakwet', 'Baringo', 'Laikipia', 'Samburu', 'Turkana', 'West Pokot', 'Trans Nzoia', 'Narok', 'Kajiado']),
  ('Western Region', ARRAY['Kisumu', 'Kakamega', 'Siaya', 'Busia', 'Bungoma', 'Vihiga', 'Migori', 'Kisii', 'Nyamira', 'Homabay']),
  ('Eastern Region', ARRAY['Meru', 'Embu', 'Machakos', 'Kitui', 'Makueni', 'Tharaka-Nithi', 'Isiolo', 'Marsabit']),
  ('Coast Region', ARRAY['Mombasa', 'Kilifi', 'Kwale', 'Taita-Taveta', 'Tana River', 'Lamu']),
  ('North Eastern Region', ARRAY['Garissa', 'Wajir', 'Mandera'])
ON CONFLICT (name) DO NOTHING;

-- Equipment Categories
INSERT INTO public.categories (name, description) VALUES
  ('Hematology', 'Blood cell counting and analysis equipment'),
  ('Immunoassay', 'Immunoassay analyzers for hormones, cardiac markers, etc.'),
  ('Chemistry', 'Clinical chemistry and biochemistry analyzers'),
  ('Immunofluorescence', 'Fluorescence immunoassay analyzers'),
  ('Lipid Analysis', 'Lipid profile and cardiovascular risk analyzers'),
  ('Urinalysis', 'Urine analysis and sediment analyzers'),
  ('ESR', 'Erythrocyte Sedimentation Rate analyzers'),
  ('Electrolyte', 'Electrolyte and blood gas analyzers'),
  ('Blood Gas', 'Point-of-care blood gas analyzers'),
  ('Coagulation', 'Coagulation and hemostasis analyzers')
ON CONFLICT (name) DO NOTHING;

-- Subcategories (Equipment Models)
DO $$
DECLARE
  v_hem UUID;
  v_imm UUID;
  v_che UUID;
  v_flu UUID;
  v_lip UUID;
  v_uri UUID;
  v_esr UUID;
  v_ele UUID;
  v_bga UUID;
  v_coa UUID;
BEGIN
  SELECT id INTO v_hem FROM public.categories WHERE name = 'Hematology';
  SELECT id INTO v_imm FROM public.categories WHERE name = 'Immunoassay';
  SELECT id INTO v_che FROM public.categories WHERE name = 'Chemistry';
  SELECT id INTO v_flu FROM public.categories WHERE name = 'Immunofluorescence';
  SELECT id INTO v_lip FROM public.categories WHERE name = 'Lipid Analysis';
  SELECT id INTO v_uri FROM public.categories WHERE name = 'Urinalysis';
  SELECT id INTO v_esr FROM public.categories WHERE name = 'ESR';
  SELECT id INTO v_ele FROM public.categories WHERE name = 'Electrolyte';
  SELECT id INTO v_bga FROM public.categories WHERE name = 'Blood Gas';
  SELECT id INTO v_coa FROM public.categories WHERE name = 'Coagulation';

  -- Hematology
  INSERT INTO public.subcategories (category_id, name, manufacturer) VALUES
    (v_hem, 'DYMIND DH36', 'DYMIND'),
    (v_hem, 'DYMIND DF52', 'DYMIND'),
    (v_hem, 'DYMIND DF55', 'DYMIND'),
    (v_hem, 'DYMIND DH76', 'DYMIND'),
    (v_hem, 'DYMIND DH800', 'DYMIND')
  ON CONFLICT (category_id, name) DO NOTHING;

  -- Immunoassay
  INSERT INTO public.subcategories (category_id, name, manufacturer) VALUES
    (v_imm, 'FINECARE FS113', 'Wondfo'),
    (v_imm, 'FINECARE FS205', 'Wondfo')
  ON CONFLICT (category_id, name) DO NOTHING;

  -- Chemistry
  INSERT INTO public.subcategories (category_id, name, manufacturer) VALUES
    (v_che, 'SEAMATY SG1', 'Seamaty'),
    (v_che, 'SEAMATY SD1', 'Seamaty'),
    (v_che, 'ICUBIO', 'iCubio'),
    (v_che, 'ZYBIO EXC200', 'Zybio')
  ON CONFLICT (category_id, name) DO NOTHING;

  -- Immunofluorescence
  INSERT INTO public.subcategories (category_id, name, manufacturer) VALUES
    (v_flu, 'ANBIO AF100', 'Anbio'),
    (v_flu, 'ANBIO AF100C', 'Anbio'),
    (v_flu, 'ANBIO AF1200', 'Anbio')
  ON CONFLICT (category_id, name) DO NOTHING;

  -- Lipid
  INSERT INTO public.subcategories (category_id, name, manufacturer) VALUES
    (v_lip, 'LIPIDIAG MLA-1', 'Lipidiag')
  ON CONFLICT (category_id, name) DO NOTHING;

  -- Urinalysis
  INSERT INTO public.subcategories (category_id, name, manufacturer) VALUES
    (v_uri, 'URIT HB PH01', 'URIT'),
    (v_uri, 'URIT 50', 'URIT'),
    (v_uri, 'URIT US-500', 'URIT'),
    (v_uri, 'URIT 600', 'URIT')
  ON CONFLICT (category_id, name) DO NOTHING;

  -- ESR
  INSERT INTO public.subcategories (category_id, name, manufacturer) VALUES
    (v_esr, 'ESR 20', 'Biocare')
  ON CONFLICT (category_id, name) DO NOTHING;

  -- Electrolyte
  INSERT INTO public.subcategories (category_id, name, manufacturer) VALUES
    (v_ele, 'EL 120', 'Biocare')
  ON CONFLICT (category_id, name) DO NOTHING;

  -- Blood Gas
  INSERT INTO public.subcategories (category_id, name, manufacturer) VALUES
    (v_bga, 'PERFOX 3000A EASY', 'Perfox')
  ON CONFLICT (category_id, name) DO NOTHING;

  -- Coagulation
  INSERT INTO public.subcategories (category_id, name, manufacturer) VALUES
    (v_coa, 'CYBEREAGENT', 'CyberEagent')
  ON CONFLICT (category_id, name) DO NOTHING;
END $$;

-- Default service rates
INSERT INTO public.service_rates (service_type, rate, description) VALUES
  ('preventive', 5000.00, 'Standard preventive maintenance rate (KES)'),
  ('corrective', 8000.00, 'Corrective maintenance and repairs (KES)'),
  ('installation', 10000.00, 'Equipment installation service (KES)'),
  ('calibration', 6000.00, 'Calibration service (KES)'),
  ('emergency', 15000.00, 'Emergency call-out service (KES)')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DEFAULT ADMIN USER
-- Email: biocarehealthsystems@gmail.com
-- Password: Biocare 2026
-- ============================================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Skip if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'biocarehealthsystems@gmail.com') THEN
    -- Still ensure the profile has admin role
    UPDATE public.profiles
    SET role = 'admin', name = 'Biocare Admin'
    WHERE email = 'biocarehealthsystems@gmail.com';
    RETURN;
  END IF;

  v_user_id := gen_random_uuid();

  -- Insert into Supabase auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'biocarehealthsystems@gmail.com',
    crypt('Biocare 2026', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Biocare Admin","role":"admin"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  -- The trigger handle_new_user() fires automatically and creates the profile.
  -- We then update it to ensure the admin role is set correctly.
  UPDATE public.profiles
  SET role = 'admin', name = 'Biocare Admin'
  WHERE id = v_user_id;

END $$;
