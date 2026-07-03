-- ============================================================
-- MaintX v0.6 — Patch SQL (Lot A, partie 2)
-- Suivi public de panne ("pizza tracker") + statut dégradé autorisé
-- À exécuter dans SQL Editor de Supabase
-- ============================================================

-- ------------------------------------------------------------
-- 1. SUIVI PUBLIC DE PANNE
--    Chaque intervention a un jeton de suivi. La personne qui
--    déclare via QR reçoit un lien #/suivi/<token> sans compte.
-- ------------------------------------------------------------
alter table interventions add column if not exists track_token uuid not null default gen_random_uuid();
create unique index if not exists idx_interventions_track on interventions (track_token);

-- qr_declare retourne désormais le jeton de suivi
drop function if exists qr_declare(uuid, text, text);
create function qr_declare(qr uuid, p_title text, p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_m machines%rowtype; v_token uuid;
begin
  select * into v_m from machines where qr_token = qr;
  if v_m.id is null then
    raise exception 'QR invalide';
  end if;
  insert into interventions (org_id, machine_id, type, priority, title, description)
  values (v_m.org_id, v_m.id, 'curative', 2, p_title,
          'Déclaré via QR code par : ' || coalesce(nullif(p_name,''), 'anonyme'))
  returning track_token into v_token;
  update machines set status = 'alarm' where id = v_m.id;
  return v_token;
end $$;
grant execute on function qr_declare(uuid, text, text) to anon, authenticated;

-- Lecture publique du suivi (strict minimum, pas de données sensibles)
create or replace function qr_track(token uuid)
returns table(title text, status text, machine_name text, machine_code text,
              reported_at timestamptz, started_at timestamptz, finished_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.title, i.status, m.name, m.code, i.reported_at, i.started_at, i.finished_at
  from interventions i join machines m on m.id = i.machine_id
  where i.track_token = token
$$;
grant execute on function qr_track(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 2. STATUT "DÉGRADÉ AUTORISÉ" (MEL aviation)
--    La machine tourne sous conditions, avec date limite de
--    réparation. Décision assumée et tracée.
-- ------------------------------------------------------------
alter table machines drop constraint machines_status_check;
alter table machines add constraint machines_status_check
  check (status in ('running','stopped','maintenance','alarm','degraded'));
alter table machines add column if not exists degraded_conditions text;
alter table machines add column if not exists degraded_deadline date;
