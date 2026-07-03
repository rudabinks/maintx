-- ============================================================
-- MaintX v0.4 — Patch SQL
-- Causes de panne + commentaires d'intervention
-- À exécuter dans SQL Editor de Supabase
-- ============================================================

-- ------------------------------------------------------------
-- 1. CAUSE DE PANNE (renseignée par le technicien sur les curatifs)
--    Alimente le Pareto des causes dans l'onglet Analyse
-- ------------------------------------------------------------
alter table interventions add column if not exists failure_cause text
  check (failure_cause in ('mecanique','electrique','pneumatique','hydraulique','cn_automatisme','autre'));

-- ------------------------------------------------------------
-- 2. COMMENTAIRES D'INTERVENTION (fil de traçabilité)
-- ------------------------------------------------------------
create table if not exists intervention_comments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  intervention_id uuid not null references interventions(id) on delete cascade,
  author_id       uuid references profiles(id),
  body            text not null,
  created_at      timestamptz not null default now()
);
alter table intervention_comments enable row level security;
create policy org_comments on intervention_comments
  for all using (org_id = auth_org_id() or is_superadmin());
create index if not exists idx_comments_intervention on intervention_comments (intervention_id);
