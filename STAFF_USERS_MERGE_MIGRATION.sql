-- ================================================================
--  AJIGS CONNECT — STAFF & USERS MERGE MIGRATION
--  Run in Supabase SQL Editor (KABOMO COLLECTIONS project)
--  Adds login-access fields directly to the staff table so
--  Staff and Users become ONE panel managed by the Proprietor.
-- ================================================================

ALTER TABLE public.ajigs_staff
  ADD COLUMN IF NOT EXISTS has_login   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email       TEXT,
  ADD COLUMN IF NOT EXISTS app_role    TEXT DEFAULT 'Staff' CHECK (app_role IN ('Proprietor','Staff')),
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]';

CREATE UNIQUE INDEX IF NOT EXISTS idx_ajigs_staff_email ON public.ajigs_staff(email) WHERE email IS NOT NULL;

-- Verify
SELECT id, name, role, has_login, email, app_role, permissions FROM public.ajigs_staff;
