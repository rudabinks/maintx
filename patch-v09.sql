-- ============================================================
-- MaintX v0.9 — Patch SQL (Lot B : inbox de triage)
-- À exécuter dans SQL Editor de Supabase
-- ============================================================

-- Triage des signalements QR : pending → accepted/deferred/rejected/merged
alter table interventions add column if not exists triage text
  check (triage in ('pending','accepted','deferred','rejected','merged'));
alter table interventions add column if not exists duplicate_of uuid references interventions(id) on delete set null;

-- Les déclarations QR arrivent en file de triage
drop function if exists qr_declare(uuid, text, text, boolean);
create function qr_declare(qr uuid, p_title text, p_name text, p_can_run boolean default false)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_m machines%rowtype; v_token uuid;
begin
  select * into v_m from machines where qr_token = qr;
  if v_m.id is null then
    raise exception 'QR invalide';
  end if;
  insert into interventions (org_id, machine_id, type, priority, title, description, triage)
  values (v_m.org_id, v_m.id, 'curative',
          case when p_can_run then 2 else 3 end,
          p_title,
          'Déclaré via QR code par : ' || coalesce(nullif(p_name,''), 'anonyme')
          || case when p_can_run then ' — la machine peut encore tourner' else ' — machine arrêtée' end,
          'pending')
  returning track_token into v_token;
  if p_can_run then
    update machines set status = 'degraded',
      degraded_conditions = 'Signalement opérateur : ' || p_title || ' — conditions à préciser par la maintenance',
      degraded_deadline = null
    where id = v_m.id and status <> 'alarm';
  else
    update machines set status = 'alarm' where id = v_m.id;
  end if;
  return v_token;
end $$;
grant execute on function qr_declare(uuid, text, text, boolean) to anon, authenticated;

-- Le suivi public suit l'intervention maître en cas de doublon fusionné
drop function if exists qr_track(uuid);
create function qr_track(token uuid)
returns table(title text, status text, machine_name text, machine_code text,
              reported_at timestamptz, acked_at timestamptz,
              started_at timestamptz, finished_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.title, i.status, m.name, m.code, i.reported_at, i.acked_at, i.started_at, i.finished_at
  from interventions i0
  join interventions i on i.id = coalesce(i0.duplicate_of, i0.id)
  join machines m on m.id = i.machine_id
  where i0.track_token = token
$$;
grant execute on function qr_track(uuid) to anon, authenticated;
