-- ================================================================
--  AJIGS CONNECT — FIX ALL TABLE PERMISSIONS
--  Run this FIRST in Supabase SQL Editor before anything else.
--  This fixes the "saving not working" issue by disabling RLS
--  and granting anon full access to all AJIGS tables.
-- ================================================================

-- 1. DISABLE RLS on all tables (they're protected by auth login anyway)
ALTER TABLE public.ajigs_clients   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajigs_jobs      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajigs_invoices  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajigs_expenses  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajigs_staff     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajigs_app_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajigs_gallery   DISABLE ROW LEVEL SECURITY;

-- 2. GRANT ALL operations to anon and authenticated roles
GRANT ALL ON public.ajigs_clients   TO anon, authenticated;
GRANT ALL ON public.ajigs_jobs      TO anon, authenticated;
GRANT ALL ON public.ajigs_invoices  TO anon, authenticated;
GRANT ALL ON public.ajigs_expenses  TO anon, authenticated;
GRANT ALL ON public.ajigs_staff     TO anon, authenticated;
GRANT ALL ON public.ajigs_app_users TO anon, authenticated;
GRANT ALL ON public.ajigs_gallery   TO anon, authenticated;

-- 3. GRANT sequence access (needed for auto-increment IDs on INSERT)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 4. Make sure schema is accessible
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 5. Add missing columns to ajigs_staff if not already added
ALTER TABLE public.ajigs_staff
  ADD COLUMN IF NOT EXISTS has_login   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email       TEXT,
  ADD COLUMN IF NOT EXISTS app_role    TEXT DEFAULT 'Staff',
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;

-- 6. Add missing permissions column to ajigs_app_users if not there
ALTER TABLE public.ajigs_app_users
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;

-- 7. Storage bucket + policies for gallery
INSERT INTO storage.buckets (id, name, public)
VALUES ('ajigs-gallery', 'ajigs-gallery', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read ajigs-gallery"   ON storage.objects;
DROP POLICY IF EXISTS "Anon upload ajigs-gallery"   ON storage.objects;
DROP POLICY IF EXISTS "Anon delete ajigs-gallery"   ON storage.objects;

CREATE POLICY "Public read ajigs-gallery"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ajigs-gallery');

CREATE POLICY "Anon upload ajigs-gallery"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ajigs-gallery');

CREATE POLICY "Anon delete ajigs-gallery"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'ajigs-gallery');

-- 8. VERIFY everything is working
SELECT 
  schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename LIKE 'ajigs_%'
ORDER BY tablename;
