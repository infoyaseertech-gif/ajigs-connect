-- =====================================================================
-- KABOMO COLLECTIONS — Complete Database Setup
-- Paste this ENTIRE block into Supabase SQL Editor and click RUN
-- =====================================================================

-- Clean start (drops old tables if they exist)
drop table if exists kc_expenses cascade;
drop table if exists kc_debts cascade;
drop table if exists kc_transactions cascade;
drop table if exists kc_catalog cascade;
drop table if exists kc_users cascade;

-- 1. USERS
create table kc_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique not null,
  password_hash text not null,
  security_question text not null,
  security_answer text not null,
  capital numeric default 0,
  created_at timestamptz default now()
);

-- 2. CATALOG ITEMS
create table kc_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references kc_users(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  emoji text default '💎',
  cost_price numeric default 0,
  sell_price numeric default 0,
  quantity integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. TRANSACTIONS (sales + purchases)
create table kc_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references kc_users(id) on delete cascade,
  type text not null check (type in ('sale','purchase','expense','debt_payment')),
  item_name text not null,
  item_emoji text default '💎',
  quantity integer default 1,
  unit_price numeric default 0,
  total_amount numeric default 0,
  cost_price numeric default 0,
  profit numeric default 0,
  payment_method text,
  customer_name text,
  notes text,
  created_at timestamptz default now()
);

-- 4. CUSTOMER DEBTS
create table kc_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references kc_users(id) on delete cascade,
  customer_name text not null,
  customer_phone text,
  item_name text,
  amount_owed numeric default 0,
  amount_paid numeric default 0,
  notes text,
  is_settled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. EXPENSES
create table kc_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references kc_users(id) on delete cascade,
  description text not null,
  amount numeric not null,
  category text default 'General',
  created_at timestamptz default now()
);

-- 6. DISABLE ROW LEVEL SECURITY (allows anon key to work)
alter table kc_users disable row level security;
alter table kc_catalog disable row level security;
alter table kc_transactions disable row level security;
alter table kc_debts disable row level security;
alter table kc_expenses disable row level security;

-- 7. GRANT FULL ACCESS TO ANON KEY (THIS IS THE LOGIN FIX)
grant usage on schema public to anon, authenticated;
grant all privileges on kc_users to anon, authenticated;
grant all privileges on kc_catalog to anon, authenticated;
grant all privileges on kc_transactions to anon, authenticated;
grant all privileges on kc_debts to anon, authenticated;
grant all privileges on kc_expenses to anon, authenticated;
grant all privileges on all sequences in schema public to anon, authenticated;

-- 8. IMAGE STORAGE BUCKET
insert into storage.buckets (id, name, public)
values ('kabomo-items', 'kabomo-items', true)
on conflict (id) do update set public = true;

drop policy if exists "allow_all_storage" on storage.objects;
create policy "allow_all_storage" on storage.objects
  for all using (true) with check (true);

grant all on storage.objects to anon, authenticated;
grant all on storage.buckets to anon, authenticated;

-- 9. VERIFY — Should show 5 table names below
select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'kc_%'
order by table_name;

-- Expected result:
-- kc_catalog
-- kc_debts
-- kc_expenses
-- kc_transactions
-- kc_users
