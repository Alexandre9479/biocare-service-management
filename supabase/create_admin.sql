-- ============================================================
-- RUN THIS IN SUPABASE SQL EDITOR to create the admin account
-- (use this if you already ran schema.sql without the admin block)
--
-- Email:    biocarehealthsystems@gmail.com
-- Password: Biocare 2026
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'biocarehealthsystems@gmail.com') THEN
    RAISE NOTICE 'User already exists. Ensuring admin role...';
    UPDATE public.profiles
    SET role = 'admin', name = 'Biocare Admin'
    WHERE email = 'biocarehealthsystems@gmail.com';
    RAISE NOTICE 'Done.';
    RETURN;
  END IF;

  v_user_id := gen_random_uuid();

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

  -- Ensure admin role on profile (trigger may run slightly after)
  PERFORM pg_sleep(0.1);

  UPDATE public.profiles
  SET role = 'admin', name = 'Biocare Admin'
  WHERE id = v_user_id;

  RAISE NOTICE 'Admin user created successfully: biocarehealthsystems@gmail.com';
END $$;

-- Verify it worked
SELECT id, name, email, role, created_at
FROM public.profiles
WHERE email = 'biocarehealthsystems@gmail.com';
