-- ================================================================
--  AJIGS CONNECT — FIX LOGIN (Run in Supabase SQL Editor)
--  This adds the password_hash column and resets all users
--  so they can log in immediately.
-- ================================================================

-- 1. Add password_hash column (safe to run even if it exists)
ALTER TABLE public.ajigs_app_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';

-- 2. Make sure RLS is off and permissions are correct
ALTER TABLE public.ajigs_app_users DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ajigs_app_users TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 3. Show all current users so you can see what's there
SELECT id, name, email, role, is_active, 
       CASE WHEN password_hash IS NULL OR password_hash = '' 
            THEN 'NO PASSWORD SET' 
            ELSE 'password set (' || length(password_hash) || ' chars)'
       END as password_status
FROM public.ajigs_app_users
ORDER BY id;
