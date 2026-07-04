-- ============================================================
-- MaintX v0.8 — Patch SQL
-- Prise en compte de la panne (étape "vu" dans le suivi public)
-- À exécuter dans SQL Editor de Supabase
-- ============================================================

alter table interventions add column if not exists acked_at timestamptz;

-- qr_track renvoie désormais la date de prise en compte
drop function if exists qr_track(uuid);
create function qr_track(token uuid)
returns table(title text, status text, machine_name text, machine_code text,
              reported_at timestamptz, acked_at timestamptz,
              started_at timestamptz, finished_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.title, i.status, m.name, m.code, i.reported_at, i.acked_at, i.started_at, i.finished_at
  from interventions i join machines m on m.id = i.machine_id
  where i.track_token = token
$$;
grant execute on function qr_track(uuid) to anon, authenticated;
