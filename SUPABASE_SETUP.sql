-- ================================================================
--  AJIGS CONNECT — Database Setup
--  For KABOMO COLLECTIONS Supabase Project
--  All tables prefixed with ajigs_ to avoid conflict with kc_ tables
--  Run in Supabase SQL Editor → New Query → Paste → Run
-- ================================================================

-- DROP EXISTING AJIGS TABLES (safe to re-run)
DROP TABLE IF EXISTS public.ajigs_invoices   CASCADE;
DROP TABLE IF EXISTS public.ajigs_jobs       CASCADE;
DROP TABLE IF EXISTS public.ajigs_clients    CASCADE;
DROP TABLE IF EXISTS public.ajigs_expenses   CASCADE;
DROP TABLE IF EXISTS public.ajigs_staff      CASCADE;
DROP TABLE IF EXISTS public.ajigs_app_users  CASCADE;

-- ================================================================
--  CREATE TABLES
-- ================================================================

CREATE TABLE public.ajigs_app_users (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL UNIQUE,
  role        TEXT        NOT NULL DEFAULT 'Staff'
                          CHECK (role IN ('Proprietor','Staff')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ajigs_clients (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  phone       TEXT,
  location    TEXT,
  address     TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ajigs_staff (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  role        TEXT,
  phone       TEXT,
  status      TEXT        NOT NULL DEFAULT 'Active'
                          CHECK (status IN ('Active','Inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ajigs_jobs (
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

CREATE TABLE public.ajigs_invoices (
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

CREATE TABLE public.ajigs_expenses (
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

-- ================================================================
--  SET INVOICE SEQUENCE TO START AT 129
-- ================================================================
SELECT setval('public.ajigs_invoices_id_seq', 128, TRUE);

-- ================================================================
--  INDEXES
-- ================================================================
CREATE INDEX idx_ajigs_jobs_status       ON public.ajigs_jobs(status);
CREATE INDEX idx_ajigs_jobs_service      ON public.ajigs_jobs(service);
CREATE INDEX idx_ajigs_jobs_client       ON public.ajigs_jobs(client_name);
CREATE INDEX idx_ajigs_invoices_status   ON public.ajigs_invoices(status);
CREATE INDEX idx_ajigs_invoices_client   ON public.ajigs_invoices(client_name);
CREATE INDEX idx_ajigs_invoices_date     ON public.ajigs_invoices(invoice_date DESC);
CREATE INDEX idx_ajigs_expenses_cat      ON public.ajigs_expenses(category);
CREATE INDEX idx_ajigs_clients_name      ON public.ajigs_clients(name);
CREATE INDEX idx_ajigs_users_email       ON public.ajigs_app_users(email);

-- ================================================================
--  DISABLE ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE public.ajigs_app_users  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajigs_clients    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajigs_staff      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajigs_jobs       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajigs_invoices   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajigs_expenses   DISABLE ROW LEVEL SECURITY;

-- ================================================================
--  GRANT PERMISSIONS
-- ================================================================
GRANT ALL ON public.ajigs_app_users  TO anon, authenticated;
GRANT ALL ON public.ajigs_clients    TO anon, authenticated;
GRANT ALL ON public.ajigs_staff      TO anon, authenticated;
GRANT ALL ON public.ajigs_jobs       TO anon, authenticated;
GRANT ALL ON public.ajigs_invoices   TO anon, authenticated;
GRANT ALL ON public.ajigs_expenses   TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ================================================================
--  SEED DATA
-- ================================================================

INSERT INTO public.ajigs_app_users (name, email, role, is_active)
VALUES ('Proprietor', 'admin@ajigs.com', 'Proprietor', TRUE);

INSERT INTO public.ajigs_clients (name, phone, location, address, created_by) VALUES
  ('Alh. Yakubu',      '08031234567', 'Sabon Kawo, Kaduna',   'Sabon Kawo, Kaduna State',        'Proprietor'),
  ('Mrs. Ramatu Umar', '07055667788', 'Barnawa, Kaduna',      'Barnawa GRA, Kaduna South',       'Proprietor'),
  ('Dr. Idris Musa',   '08099887766', 'GRA Kaduna',           'GRA Kaduna South',                'Proprietor'),
  ('Shell Nigeria',    '08011223344', 'Unguwar Rimi, Kaduna', 'Unguwar Rimi Industrial, Kaduna', 'Proprietor');

INSERT INTO public.ajigs_staff (name, role, phone, status) VALUES
  ('Mohammed Hassan',  'Senior Field Technician', '08022334455', 'Active'),
  ('Amina Suleiman',   'Field Technician',         '07066778899', 'Active'),
  ('Ibrahim Abubakar', 'Driver / Logistics',       '08033445566', 'Active');

INSERT INTO public.ajigs_invoices (id, client_name, client_address, invoice_date, due_date, items, status, created_by)
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

SELECT setval('public.ajigs_invoices_id_seq', 128, TRUE);

INSERT INTO public.ajigs_jobs (client_name, client_phone, client_address, service, scheduled_date, assigned_staff, amount, status, description, created_by) VALUES
  ('Alh. Yakubu',      '08031234567', 'Sabon Kawo, Kaduna',             'Fumigation', '2026-05-05', 'Mohammed Hassan', 170000, 'Invoiced',    'Fumigation for a duplex',              'Proprietor'),
  ('Alh. Yakubu',      '08031234567', 'Sabon Kawo, Kaduna',             'Cleaning',   '2026-05-05', 'Amina Suleiman',  200000, 'Invoiced',    'Deep cleaning for a duplex',           'Proprietor'),
  ('Mrs. Ramatu Umar', '07055667788', 'Barnawa, Kaduna',                'Laundry',    '2026-05-20', NULL,               35000, 'Completed',   'Bulk laundry service',                 'Proprietor'),
  ('Dr. Idris Musa',   '08099887766', 'GRA Kaduna',                     'Upholstery', '2026-06-01', 'Mohammed Hassan',  60000, 'In Progress', 'Sofa and carpet deep cleaning',        'Proprietor'),
  ('Shell Nigeria',    '08011223344', 'Unguwar Rimi Industrial, Kaduna', 'Fumigation', '2026-06-05', NULL,              250000, 'Pending',     'Office complex fumigation - 3 floors', 'Proprietor');

INSERT INTO public.ajigs_expenses (description, category, amount, expense_date, added_by) VALUES
  ('Diesel for operations vehicle',   'Fuel',      15000,  '2026-05-10', 'Proprietor'),
  ('Fumigation chemicals restock',    'Chemicals', 45000,  '2026-05-15', 'Proprietor'),
  ('Field staff salaries - May 2026', 'Salaries',  120000, '2026-05-31', 'Proprietor'),
  ('Cleaning equipment replacement',  'Equipment',  28000, '2026-06-02', 'Proprietor'),
  ('Diesel - June operations',        'Fuel',       12000, '2026-06-05', 'Proprietor');

-- ================================================================
--  VERIFY — you should see all 6 tables with rows
-- ================================================================
SELECT 'ajigs_app_users' AS table_name, COUNT(*) AS rows FROM public.ajigs_app_users
UNION ALL SELECT 'ajigs_clients',  COUNT(*) FROM public.ajigs_clients
UNION ALL SELECT 'ajigs_staff',    COUNT(*) FROM public.ajigs_staff
UNION ALL SELECT 'ajigs_jobs',     COUNT(*) FROM public.ajigs_jobs
UNION ALL SELECT 'ajigs_invoices', COUNT(*) FROM public.ajigs_invoices
UNION ALL SELECT 'ajigs_expenses', COUNT(*) FROM public.ajigs_expenses;
