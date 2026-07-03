-- ============================================================
-- MaintX v0.5 — Patch SQL (Vague 2 : fondamentaux)
-- Pièces détachées + compteur d'heures + préventif horaire
-- À exécuter dans SQL Editor de Supabase
-- ============================================================

-- ------------------------------------------------------------
-- 1. PIÈCES DÉTACHÉES (stock simple, alerte stock mini)
--    La consommation est historisée dans interventions.parts_used
--    (jsonb [{part_id, ref, name, qty, cost}]) au moment de la saisie.
-- ------------------------------------------------------------
create table if not exists parts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  ref         text,                             -- référence fabricant (ex: 6205-2RS)
  name        text not null,                    -- ex: Roulement broche
  location    text,                             -- ex: Armoire A3
  qty         numeric not null default 0,
  min_qty     numeric not null default 0,       -- seuil d'alerte stock bas
  unit_cost   numeric,                          -- € HT
  created_at  timestamptz not null default now()
);
alter table parts enable row level security;
create policy org_parts on parts
  for all using (org_id = auth_org_id() or is_superadmin());
create index if not exists idx_parts_org on parts (org_id);

-- ------------------------------------------------------------
-- 2. COMPTEUR D'HEURES MACHINE (saisie manuelle pour l'instant,
--    sera alimenté automatiquement par le plan Connect plus tard)
-- ------------------------------------------------------------
alter table machines add column if not exists meter_hours numeric not null default 0;

-- ------------------------------------------------------------
-- 3. PRÉVENTIF AU COMPTEUR (en plus du calendaire)
--    Une gamme peut avoir freq_days ET/OU freq_hours.
--    Due si next_due atteint OU si meter_hours >= last_done_hours + freq_hours.
-- ------------------------------------------------------------
alter table preventive_plans add column if not exists freq_hours numeric;
alter table preventive_plans add column if not exists last_done_hours numeric not null default 0;
