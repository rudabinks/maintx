-- ============================================================
-- MaintX v0.15 — Patch SQL
-- Planification des interventions (calendrier) + directives IA
-- À exécuter dans SQL Editor de Supabase
-- ============================================================

-- Date planifiée (pour le calendrier) + directives rédigées pour le technicien.
-- assigned_to (technicien) existe déjà dans la table interventions.
alter table interventions add column if not exists scheduled_for date;
alter table interventions add column if not exists directive text;

create index if not exists idx_interventions_scheduled on interventions (org_id, scheduled_for);
