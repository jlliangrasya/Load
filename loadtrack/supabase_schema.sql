-- Run this in your Supabase SQL Editor

create table if not exists capital_purchases (
  id text primary key,
  date text not null,
  network text not null,
  face_value numeric not null,
  cost_price numeric not null,
  commission numeric not null,
  remaining_balance numeric not null,
  notes text,
  created_at text not null
);

create table if not exists clients (
  id text primary key,
  name text not null,
  contact_number text not null,
  address text,
  latitude numeric,
  longitude numeric,
  total_load_received numeric not null default 0,
  total_paid numeric not null default 0,
  outstanding_balance numeric not null default 0,
  last_activity text,
  created_at text not null,
  updated_at text not null
);

create table if not exists disbursements (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  date text not null,
  network text not null,
  face_value numeric not null,
  selling_price numeric not null,
  markup numeric not null,
  status text not null,
  failure_reason text,
  capital_purchase_id text not null references capital_purchases(id),
  notes text,
  created_at text not null
);

create table if not exists payments (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  date text not null,
  amount numeric not null,
  method text not null,
  reference_number text,
  signature_image text not null default '',
  disbursement_ids jsonb,
  notes text,
  created_at text not null
);

create table if not exists collection_list (
  id text primary key,
  client_id text not null references clients(id) on delete cascade,
  amount numeric not null,
  collected numeric not null default 0,
  signature_image text,
  created_at text not null
);

create table if not exists expenses (
  id text primary key,
  date text not null,
  category text not null,
  description text not null,
  amount numeric not null,
  created_at text not null
);

create table if not exists commission_logs (
  id text primary key,
  date text not null,
  network text not null,
  old_rate numeric not null,
  new_rate numeric not null,
  notes text,
  created_at text not null
);

create table if not exists app_settings (
  id integer primary key default 1,
  default_smart_markup numeric not null default 0,
  default_globe_markup numeric not null default 0,
  auto_markup_enabled integer not null default 0,
  discount_enabled integer not null default 0,
  discount_rates text not null default '2,3,5',
  hide_selling_if_equal integer not null default 1,
  owner_name text not null default '',
  business_name text not null default 'LoadTrack',
  pin text not null default '0000'
);

-- Insert default settings row
insert into app_settings (id) values (1) on conflict (id) do nothing;

-- Disable RLS (single user app, no auth needed)
alter table capital_purchases disable row level security;
alter table clients disable row level security;
alter table disbursements disable row level security;
alter table payments disable row level security;
alter table collection_list disable row level security;
alter table expenses disable row level security;
alter table commission_logs disable row level security;
alter table app_settings disable row level security;
