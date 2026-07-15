-- ============================================================
-- MaintX — patch v15 : plan CONNECT (passerelle FOCAS)
-- À exécuter dans SQL Editor de Supabase.
-- 1) Enrichit machine_events : détail des alarmes CN (n°, texte, type)
-- 2) Ajoute une clé secrète "connect_key" par organisation :
--    c'est elle que la passerelle atelier présente pour pousser
--    les événements (via l'Edge Function connect-ingest).
-- ============================================================

alter table machine_events
  add column if not exists alarm_no   bigint,          -- n° d'alarme Fanuc (ex: 401)
  add column if not exists alarm_msg  text,            -- texte affiché sur la CN
  add column if not exists alarm_type text,            -- SV, SP, OH, MC, PS, OT…
  add column if not exists source     text not null default 'gateway'; -- gateway | manual | sim

alter table organizations
  add column if not exists connect_key uuid not null default gen_random_uuid();

-- Index déjà présent : machine_events (machine_id, at desc)
-- RLS déjà en place (org_isolation_*) — l'ingestion passe par le
-- service role dans l'Edge Function, après vérification de connect_key.
