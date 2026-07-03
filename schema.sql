-- ============================================================
-- MaintX — Schéma multi-tenant Supabase (PostgreSQL)
-- GMAO SaaS pour PME industrielles
-- À exécuter dans SQL Editor de Supabase
-- ============================================================

-- ------------------------------------------------------------
-- 1. ORGANISATIONS (tenants) — une ligne par entreprise cliente
-- ------------------------------------------------------------
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,              -- ex: 'atelier-durand'
  plan        text not null default 'standard',  -- standard | connect (machines connectées)
  logo_url    text,
  floorplan_url text,                            -- plan d'atelier (image)
  settings    jsonb not null default '{}',       -- seuils, préférences (ex: seuil arrêt 15 min)
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. PROFILS UTILISATEURS — lié à auth.users de Supabase
--    Rôles : operator (déclare), technician (intervient),
--            manager (KPI + config), superadmin (toi, tous tenants)
-- ------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid references organizations(id) on delete cascade,
  full_name   text not null,
  role        text not null default 'operator'
              check (role in ('operator','technician','manager','superadmin')),
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. ZONES d'atelier (optionnel : îlots, bâtiments…)
-- ------------------------------------------------------------
create table zones (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null
);

-- ------------------------------------------------------------
-- 4. MACHINES (parc)
-- ------------------------------------------------------------
create table machines (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  zone_id       uuid references zones(id) on delete set null,
  name          text not null,                   -- ex: 'Mori Seiki M300L'
  code          text,                            -- code interne / n° parc
  family        text,                            -- ex: 'CN fraisage', 'Tour', 'Compresseur'
  criticality   int not null default 2 check (criticality between 1 and 3), -- 1 faible → 3 critique
  status        text not null default 'running'
                check (status in ('running','stopped','maintenance','alarm')),
  photo_url     text,
  qr_token      uuid not null default gen_random_uuid(), -- pour l'URL du QR code
  pos_x         numeric,                         -- position % sur le plan d'atelier
  pos_y         numeric,
  meta          jsonb not null default '{}',     -- année, CN, n° série…
  created_at    timestamptz not null default now()
);
create index on machines (org_id);
create unique index on machines (qr_token);

-- ------------------------------------------------------------
-- 5. INTERVENTIONS (curatif / préventif / amélioratif)
-- ------------------------------------------------------------
create table interventions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  machine_id     uuid not null references machines(id) on delete cascade,
  type           text not null default 'curative'
                 check (type in ('curative','preventive','improvement')),
  status         text not null default 'open'
                 check (status in ('open','in_progress','waiting_parts','done')),
  priority       int not null default 2 check (priority between 1 and 3),
  title          text not null,
  description    text,
  reported_by    uuid references profiles(id),
  assigned_to    uuid references profiles(id),
  reported_at    timestamptz not null default now(),
  started_at     timestamptz,                    -- pour MTTR
  finished_at    timestamptz,
  downtime_min   int,                            -- arrêt machine réel (saisi ou calculé)
  parts_used     jsonb not null default '[]',    -- [{ref, qty, cost}]
  photos         jsonb not null default '[]'
);
create index on interventions (org_id, machine_id);
create index on interventions (org_id, status);

-- ------------------------------------------------------------
-- 6. GAMMES PRÉVENTIVES (templates + planification)
-- ------------------------------------------------------------
create table preventive_plans (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  machine_id    uuid not null references machines(id) on delete cascade,
  title         text not null,                   -- ex: 'Contrôle niveaux + graissage'
  checklist     jsonb not null default '[]',     -- [{step, done}]
  freq_days     int not null default 30,         -- périodicité
  next_due      date not null,
  active        boolean not null default true
);
create index on preventive_plans (org_id, next_due);

-- ------------------------------------------------------------
-- 7. LIGNES DE TEMPS MACHINE (option plan 'connect' — TRS)
--    Alimenté plus tard par FOCAS / MTConnect / boîtier IoT
-- ------------------------------------------------------------
create table machine_events (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  machine_id  uuid not null references machines(id) on delete cascade,
  event       text not null,                     -- run | stop | alarm
  at          timestamptz not null default now()
);
create index on machine_events (machine_id, at desc);

-- ============================================================
-- ROW LEVEL SECURITY — isolation stricte entre clients
-- ============================================================
alter table organizations   enable row level security;
alter table profiles        enable row level security;
alter table zones           enable row level security;
alter table machines        enable row level security;
alter table interventions   enable row level security;
alter table preventive_plans enable row level security;
alter table machine_events  enable row level security;

-- Helper : org de l'utilisateur courant
create or replace function auth_org_id() returns uuid
language sql stable as $$
  select org_id from profiles where id = auth.uid()
$$;

-- Helper : superadmin ?
create or replace function is_superadmin() returns boolean
language sql stable as $$
  select coalesce((select role = 'superadmin' from profiles where id = auth.uid()), false)
$$;

-- Politiques génériques : chaque table accessible uniquement
-- dans sa propre org, sauf superadmin (toi) qui voit tout.
create policy org_isolation_select on machines
  for select using (org_id = auth_org_id() or is_superadmin());
create policy org_isolation_write on machines
  for all using (org_id = auth_org_id() or is_superadmin());

create policy org_isolation_select on interventions
  for select using (org_id = auth_org_id() or is_superadmin());
create policy org_isolation_write on interventions
  for all using (org_id = auth_org_id() or is_superadmin());

create policy org_isolation_select on zones
  for select using (org_id = auth_org_id() or is_superadmin());
create policy org_isolation_write on zones
  for all using (org_id = auth_org_id() or is_superadmin());

create policy org_isolation_select on preventive_plans
  for select using (org_id = auth_org_id() or is_superadmin());
create policy org_isolation_write on preventive_plans
  for all using (org_id = auth_org_id() or is_superadmin());

create policy org_isolation_select on machine_events
  for select using (org_id = auth_org_id() or is_superadmin());
create policy org_isolation_write on machine_events
  for all using (org_id = auth_org_id() or is_superadmin());

create policy own_org on organizations
  for select using (id = auth_org_id() or is_superadmin());
create policy superadmin_manage_orgs on organizations
  for all using (is_superadmin());

create policy own_profile on profiles
  for select using (id = auth.uid() or org_id = auth_org_id() or is_superadmin());
create policy superadmin_manage_profiles on profiles
  for all using (is_superadmin());

-- ============================================================
-- VUES KPI (MTTR, pannes chroniques) — lecture directe côté app
-- ============================================================
create or replace view v_kpi_machine as
select
  m.org_id,
  m.id as machine_id,
  m.name,
  count(i.id) filter (where i.type = 'curative') as nb_pannes,
  round(avg(extract(epoch from (i.finished_at - i.started_at)) / 60)
        filter (where i.type = 'curative' and i.finished_at is not null))::int
        as mttr_min,
  sum(i.downtime_min) as downtime_total_min
from machines m
left join interventions i on i.machine_id = m.id
group by m.org_id, m.id, m.name;

-- Pannes chroniques : 3+ curatifs sur 90 jours
create or replace view v_chronic_failures as
select org_id, machine_id, count(*) as nb_90j
from interventions
where type = 'curative' and reported_at > now() - interval '90 days'
group by org_id, machine_id
having count(*) >= 3;
