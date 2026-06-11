-- ================================================================
--  AJIGS CONNECT — SUPABASE_SETUP.sql
--  Complete Database Schema
--  Run this entire file in your Supabase SQL Editor
--  Project: AJIGS CONNECT Management System
--  Developer: YaseerTech (yaseertech.vercel.app)
-- ================================================================


-- ================================================================
--  STEP 1 — ENABLE UUID EXTENSION
-- ================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ================================================================
--  STEP 2 — DROP TABLES IF THEY EXIST (clean slate)
--  Safe to run multiple times
-- ================================================================
DROP TABLE IF EXISTS public.invoices   CASCADE;
DROP TABLE IF EXISTS public.jobs       CASCADE;
DROP TABLE IF EXISTS public.clients    CASCADE;
DROP TABLE IF EXISTS public.expenses   CASCADE;
DROP TABLE IF EXISTS public.staff      CASCADE;
DROP TABLE IF EXISTS public.app_users  CASCADE;


-- ================================================================
--  STEP 3 — CREATE TABLES
-- ================================================================


-- ----------------------------------------------------------------
--  TABLE: app_users
--  Stores staff/user profile info (mirrors Supabase Auth users)
-- ----------------------------------------------------------------
CREATE TABLE public.app_users (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL UNIQUE,
  role        TEXT        NOT NULL DEFAULT 'Staff'
                          CHECK (role IN ('Proprietor', 'Staff')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.app_users             IS 'Staff and admin user profiles for AJIGS CONNECT';
COMMENT ON COLUMN public.app_users.role        IS 'Proprietor = full access, Staff = limited access';
COMMENT ON COLUMN public.app_users.is_active   IS 'Set false to deactivate without deleting';


-- ----------------------------------------------------------------
--  TABLE: clients
--  Stores client records
-- ----------------------------------------------------------------
CREATE TABLE public.clients (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  phone       TEXT,
  location    TEXT,
  address     TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.clients IS 'Client records for AJIGS CONNECT';


-- ----------------------------------------------------------------
--  TABLE: staff
--  Stores field staff / technician records
-- ----------------------------------------------------------------
CREATE TABLE public.staff (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  role        TEXT,
  phone       TEXT,
  status      TEXT        NOT NULL DEFAULT 'Active'
                          CHECK (status IN ('Active', 'Inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.staff IS 'Field staff and technicians at AJIGS CONNECT';


-- ----------------------------------------------------------------
--  TABLE: jobs
--  Stores all service jobs / work orders
-- ----------------------------------------------------------------
CREATE TABLE public.jobs (
  id               BIGSERIAL PRIMARY KEY,
  client_name      TEXT        NOT NULL,
  client_phone     TEXT,
  client_address   TEXT,
  service          TEXT        NOT NULL
                               CHECK (service IN ('Cleaning','Laundry','Upholstery','Fumigation')),
  scheduled_date   DATE,
  assigned_staff   TEXT,
  amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  status           TEXT        NOT NULL DEFAULT 'Pending'
                               CHECK (status IN ('Pending','In Progress','Completed','Invoiced')),
  description      TEXT,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.jobs              IS 'Service jobs / work orders for AJIGS CONNECT';
COMMENT ON COLUMN public.jobs.service      IS 'One of the 4 AJIGS services';
COMMENT ON COLUMN public.jobs.status       IS 'Job lifecycle: Pending > In Progress > Completed > Invoiced';
COMMENT ON COLUMN public.jobs.amount       IS 'Quoted/agreed amount in Nigerian Naira';


-- ----------------------------------------------------------------
--  TABLE: invoices
--  Stores all invoices — numbering continues from 128
-- ----------------------------------------------------------------
CREATE TABLE public.invoices (
  id               BIGSERIAL PRIMARY KEY,
  client_name      TEXT        NOT NULL,
  client_address   TEXT,
  invoice_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  due_date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  items            JSONB       NOT NULL DEFAULT '[]',
  status           TEXT        NOT NULL DEFAULT 'Unpaid'
                               CHECK (status IN ('Paid','Unpaid')),
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.invoices        IS 'Invoices for AJIGS CONNECT. Starts from INV-129 (128 already issued).';
COMMENT ON COLUMN public.invoices.items  IS 'JSON array: [{name, desc, qty, price}]';
COMMENT ON COLUMN public.invoices.status IS 'Paid or Unpaid';


-- ----------------------------------------------------------------
--  TABLE: expenses
--  Tracks all business expenses
-- ----------------------------------------------------------------
CREATE TABLE public.expenses (
  id            BIGSERIAL PRIMARY KEY,
  description   TEXT        NOT NULL,
  category      TEXT        NOT NULL DEFAULT 'Other'
                            CHECK (category IN (
                              'Fuel','Equipment','Chemicals',
                              'Salaries','Rent','Utilities',
                              'Marketing','Other'
                            )),
  amount        NUMERIC(12,2) NOT NULL,
  expense_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  added_by      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.expenses IS 'Business expenses for AJIGS CONNECT';


-- ================================================================
--  STEP 4 — SET INVOICE AUTO-INCREMENT TO START AT 129
--  (Invoice #128 was the last manually issued invoice)
-- ================================================================
SELECT setval('public.invoices_id_seq', 128, TRUE);


-- ================================================================
--  STEP 5 — INDEXES (for fast queries)
-- ================================================================
CREATE INDEX idx_jobs_status         ON public.jobs(status);
CREATE INDEX idx_jobs_service        ON public.jobs(service);
CREATE INDEX idx_jobs_client         ON public.jobs(client_name);
CREATE INDEX idx_jobs_scheduled      ON public.jobs(scheduled_date DESC);
CREATE INDEX idx_invoices_status     ON public.invoices(status);
CREATE INDEX idx_invoices_client     ON public.invoices(client_name);
CREATE INDEX idx_invoices_date       ON public.invoices(invoice_date DESC);
CREATE INDEX idx_expenses_category   ON public.expenses(category);
CREATE INDEX idx_expenses_date       ON public.expenses(expense_date DESC);
CREATE INDEX idx_clients_name        ON public.clients(name);
CREATE INDEX idx_app_users_email     ON public.app_users(email);


-- ================================================================
--  STEP 6 — DISABLE ROW LEVEL SECURITY (RLS)
--  Access is controlled by Supabase JWT token in the app
-- ================================================================
ALTER TABLE public.app_users  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses    DISABLE ROW LEVEL SECURITY;


-- ================================================================
--  STEP 7 — GRANT PERMISSIONS TO ANON AND AUTHENTICATED ROLES
-- ================================================================
GRANT ALL ON public.app_users  TO anon, authenticated;
GRANT ALL ON public.clients     TO anon, authenticated;
GRANT ALL ON public.staff       TO anon, authenticated;
GRANT ALL ON public.jobs        TO anon, authenticated;
GRANT ALL ON public.invoices    TO anon, authenticated;
GRANT ALL ON public.expenses    TO anon, authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;


-- ================================================================
--  STEP 8 — SEED DATA
--  Pre-loaded demo data — delete after going live if preferred
-- ================================================================

-- Proprietor / Owner user profile
-- NOTE: You must ALSO create this user in Supabase Auth > Users
--       with the same email and a password you choose.
--       This table row stores the display name and role only.
INSERT INTO public.app_users (name, email, role, is_active)
VALUES ('Proprietor', 'admin@ajigs.com', 'Proprietor', TRUE);


-- Sample clients (from invoice history)
INSERT INTO public.clients (name, phone, location, address, created_by) VALUES
  ('Alh. Yakubu',      '08031234567', 'Sabon Kawo, Kaduna',  'Sabon Kawo, Kaduna State',        'Proprietor'),
  ('Mrs. Ramatu Umar', '07055667788', 'Barnawa, Kaduna',     'Barnawa GRA, Kaduna South',       'Proprietor'),
  ('Dr. Idris Musa',   '08099887766', 'GRA Kaduna',          'GRA Kaduna South',                'Proprietor'),
  ('Shell Nigeria',    '08011223344', 'Unguwar Rimi, Kaduna','Unguwar Rimi Industrial, Kaduna', 'Proprietor');


-- Sample staff
INSERT INTO public.staff (name, role, phone, status) VALUES
  ('Mohammed Hassan',  'Senior Field Technician', '08022334455', 'Active'),
  ('Amina Suleiman',   'Field Technician',         '07066778899', 'Active'),
  ('Ibrahim Abubakar', 'Driver / Logistics',       '08033445566', 'Active');


-- Invoice #128 — existing invoice (already issued to Alh. Yakubu)
-- id is explicitly set to 128 to match the actual invoice
INSERT INTO public.invoices (id, client_name, client_address, invoice_date, due_date, items, status, created_by)
VALUES (
  128,
  'Alh. Yakubu',
  'Sabon Kawo, Kaduna',
  '2026-05-05',
  '2026-05-05',
  '[
    {
      "name": "FUMIGATION SERVICE",
      "desc": "Professional fumigation for a duplex, covering all rooms, kitchen, bathrooms, and surroundings. Certified chemicals and equipment are used to eliminate pests in line with health and safety standards.",
      "qty": 1,
      "price": 170000
    },
    {
      "name": "CLEANING SERVICE",
      "desc": "Professional cleaning for a duplex, covering all areas. Includes deep cleaning, disinfection, and waste removal using approved materials for a clean and hygienic environment.",
      "qty": 1,
      "price": 200000
    }
  ]',
  'Paid',
  'Proprietor'
);

-- Reset sequence AFTER inserting 128 so next invoice = 129
SELECT setval('public.invoices_id_seq', 128, TRUE);


-- Sample jobs matching the invoice history
INSERT INTO public.jobs (client_name, client_phone, client_address, service, scheduled_date, assigned_staff, amount, status, description, created_by) VALUES
  ('Alh. Yakubu',      '08031234567', 'Sabon Kawo, Kaduna',          'Fumigation',  '2026-05-05', 'Mohammed Hassan', 170000, 'Invoiced',    'Fumigation for a duplex',              'Proprietor'),
  ('Alh. Yakubu',      '08031234567', 'Sabon Kawo, Kaduna',          'Cleaning',    '2026-05-05', 'Amina Suleiman',  200000, 'Invoiced',    'Deep cleaning for a duplex',           'Proprietor'),
  ('Mrs. Ramatu Umar', '07055667788', 'Barnawa, Kaduna',             'Laundry',     '2026-05-20', NULL,               35000, 'Completed',   'Bulk laundry service',                 'Proprietor'),
  ('Dr. Idris Musa',   '08099887766', 'GRA Kaduna',                  'Upholstery',  '2026-06-01', 'Mohammed Hassan',  60000, 'In Progress', 'Sofa and carpet deep cleaning',        'Proprietor'),
  ('Shell Nigeria',    '08011223344', 'Unguwar Rimi Industrial, Kaduna','Fumigation','2026-06-05', NULL,              250000, 'Pending',     'Office complex fumigation — 3 floors', 'Proprietor');


-- Sample expenses
INSERT INTO public.expenses (description, category, amount, expense_date, added_by) VALUES
  ('Diesel for operations vehicle',    'Fuel',      15000,  '2026-05-10', 'Proprietor'),
  ('Fumigation chemicals restock',     'Chemicals', 45000,  '2026-05-15', 'Proprietor'),
  ('Field staff salaries — May 2026',  'Salaries',  120000, '2026-05-31', 'Proprietor'),
  ('Cleaning equipment replacement',  'Equipment',  28000,  '2026-06-02', 'Proprietor'),
  ('Diesel — June operations',         'Fuel',       12000, '2026-06-05', 'Proprietor');


-- ================================================================
--  STEP 9 — VERIFY SETUP
--  Run these SELECT statements to confirm everything is working
-- ================================================================

-- SELECT 'app_users'  AS tbl, COUNT(*) AS rows FROM public.app_users;
-- SELECT 'clients'    AS tbl, COUNT(*) AS rows FROM public.clients;
-- SELECT 'staff'      AS tbl, COUNT(*) AS rows FROM public.staff;
-- SELECT 'jobs'       AS tbl, COUNT(*) AS rows FROM public.jobs;
-- SELECT 'invoices'   AS tbl, COUNT(*) AS rows FROM public.invoices;
-- SELECT 'expenses'   AS tbl, COUNT(*) AS rows FROM public.expenses;
-- SELECT last_value FROM public.invoices_id_seq;  -- Should be 128


-- ================================================================
--  DONE.
--  Next invoice created will be INV-129 automatically.
--  See INSTRUCTIONS.txt for full deployment steps.
-- ================================================================
