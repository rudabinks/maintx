-- ============================================================
-- MaintX v0.7 — Patch SQL
-- Déclaration QR : "la machine peut-elle encore tourner ?"
-- À exécuter dans SQL Editor de Supabase
-- ============================================================

-- Si la machine peut tourner : statut 'degraded' (jaune) au lieu
-- de 'alarm' (rouge), priorité 2 au lieu de 3, conditions pré-remplies
-- à affiner par la maintenance.
drop function if exists qr_declare(uuid, text, text);
create function qr_declare(qr uuid, p_title text, p_name text, p_can_run boolean default false)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_m machines%rowtype; v_token uuid;
begin
  select * into v_m from machines where qr_token = qr;
  if v_m.id is null then
    raise exception 'QR invalide';
  end if;
  insert into interventions (org_id, machine_id, type, priority, title, description)
  values (v_m.org_id, v_m.id, 'curative',
          case when p_can_run then 2 else 3 end,
          p_title,
          'Déclaré via QR code par : ' || coalesce(nullif(p_name,''), 'anonyme')
          || case when p_can_run then ' — la machine peut encore tourner' else ' — machine arrêtée' end)
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
