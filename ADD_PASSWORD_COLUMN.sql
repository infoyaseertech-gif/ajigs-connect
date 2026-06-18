-- ================================================================
--  AJIGS CONNECT — ADD PASSWORD COLUMN
--  Run in Supabase SQL Editor
--  This allows passwords to be stored directly in ajigs_app_users
--  so staff can log in without needing Supabase Auth accounts.
-- ================================================================

-- Add password column to ajigs_app_users
ALTER TABLE public.ajigs_app_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';

-- Also add to ajigs_staff for reference
ALTER TABLE public.ajigs_staff
  ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';

-- Make sure anon can read/write
GRANT ALL ON public.ajigs_app_users TO anon, authenticated;
GRANT ALL ON public.ajigs_staff TO anon, authenticated;

-- Verify
SELECT id, name, email, role, is_active FROM public.ajigs_app_users;
