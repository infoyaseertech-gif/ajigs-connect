-- ================================================================
--  AJIGS CONNECT — SERVICES REBRAND + GALLERY MIGRATION
--  Run in Supabase SQL Editor (KABOMO COLLECTIONS project)
-- ================================================================

-- 1. DROP old service constraint on jobs table
ALTER TABLE public.ajigs_jobs
  DROP CONSTRAINT IF EXISTS ajigs_jobs_service_check;

-- 2. ADD new service constraint with 5 new services
ALTER TABLE public.ajigs_jobs
  ADD CONSTRAINT ajigs_jobs_service_check
  CHECK (service IN (
    'Construction',
    'Building Materials Supply',
    'Automobile Sales',
    'Engineering Projects',
    'Cleaning Services'
  ));

-- 3. CREATE GALLERY TABLE
DROP TABLE IF EXISTS public.ajigs_gallery CASCADE;

CREATE TABLE public.ajigs_gallery (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'Cleaning Services'
                          CHECK (category IN (
                            'Construction',
                            'Building Materials Supply',
                            'Automobile Sales',
                            'Engineering Projects',
                            'Cleaning Services'
                          )),
  image_url   TEXT        NOT NULL,
  description TEXT,
  uploaded_by TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ajigs_gallery_category ON public.ajigs_gallery(category);

ALTER TABLE public.ajigs_gallery DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ajigs_gallery TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 4. CREATE STORAGE BUCKET FOR GALLERY IMAGES
INSERT INTO storage.buckets (id, name, public)
VALUES ('ajigs-gallery', 'ajigs-gallery', true)
ON CONFLICT (id) DO NOTHING;

-- 5. STORAGE POLICIES — allow public read, allow upload/delete
--    (DROP first so this is safe to re-run)
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

-- 6. VERIFY
SELECT 'ajigs_gallery' AS table_name, COUNT(*) AS rows FROM public.ajigs_gallery;
SELECT id, name, public FROM storage.buckets WHERE id = 'ajigs-gallery';
