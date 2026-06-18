-- ================================================================
--  AJIGS CONNECT — GALLERY SEED DATA
--  Run AFTER FIX_PERMISSIONS.sql
--  
--  NOTE: These entries use placeholder image_url values.
--  The real URLs will be set when you upload the images from
--  the gallery folder to Supabase Storage via the dashboard upload
--  OR use the Upload Script (see UPLOAD_GALLERY_IMAGES.html)
-- ================================================================

-- First make sure gallery table exists
CREATE TABLE IF NOT EXISTS public.ajigs_gallery (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'Construction',
  image_url   TEXT        NOT NULL DEFAULT '',
  description TEXT,
  uploaded_by TEXT        DEFAULT 'Admin',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ajigs_gallery DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ajigs_gallery TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Clear old seed data and re-insert clean
DELETE FROM public.ajigs_gallery WHERE uploaded_by = 'Admin';

-- Insert gallery records (image_url will be updated after upload)
INSERT INTO public.ajigs_gallery (title, category, description, uploaded_by, image_url) VALUES
('Bridge Foundation Construction — Kaduna',  'Construction',           'Foundation and formwork for bridge/culvert construction in Kaduna. Concrete walls and bamboo scaffolding.', 'Admin', ''),
('Bathroom Tiling & Plumbing Works',          'Construction',           'Completed bathroom with wall tiling, water heater installation and plumbing works.',                         'Admin', ''),
('Completed Duplex — Exterior View',          'Construction',           'Exterior view of a completed duplex with marble cladding, aluminium windows and compound paving.',           'Admin', ''),
('Electrical Works & Wiring Installation',    'Engineering Projects',   'Electrical conduit and wiring installation on building exterior.',                                           'Admin', ''),
('Compound & Lawn Maintenance',               'Cleaning Services',      'Compound cleaning and lawn maintenance service — after treatment view.',                                     'Admin', ''),
('Compound Tiling & Water Tank Installation', 'Construction',           'Tiled compound with overhead water tank installation and perimeter wall.',                                   'Admin', ''),
('Completed Mansion — Kaduna',                'Construction',           'Fully completed mansion with pitched roof, stone cladding, large compound and landscaping.',                'Admin', ''),
('Perimeter Fence & Gate Pillars',            'Construction',           'Completed perimeter fence with decorative pillars, plastering and landscaping.',                            'Admin', ''),
('Commercial Building — Courtyard & Railings','Engineering Projects',   'Commercial complex showing courtyard tiling, steel railings fabrication and landscaping.',                  'Admin', ''),
('Commercial Complex — Open Courtyard',       'Engineering Projects',   'Wide-angle view of completed commercial complex with central courtyard and steel rail works.',              'Admin', ''),
('Tiled Corridor & Interior Finishing',       'Construction',           'Completed building corridor with wood-effect floor tiles and painted walls.',                               'Admin', ''),
('Indoor Courtyard with Drainage',            'Construction',           'Indoor courtyard with drainage channel, tiling and potted plants.',                                         'Admin', ''),
('Building Corridor — Floor Tiling Complete', 'Construction',           'Long building corridor with completed floor tiling, ceiling works and outdoor view.',                       'Admin', '');

-- Verify
SELECT id, title, category FROM public.ajigs_gallery ORDER BY id;
