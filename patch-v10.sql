-- ============================================================
-- MaintX v0.10 — Patch SQL
-- Photo sur la déclaration QR + le QR ne force plus le mode dégradé
-- À exécuter dans SQL Editor de Supabase
-- ============================================================

-- ------------------------------------------------------------
-- 1. STORAGE : l'opérateur anonyme peut envoyer une photo
--    Chemin : qr/<machine_id>/<fichier> — lecture réservée à l'org
-- ------------------------------------------------------------
create policy qr_photo_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'docs' and (storage.foldername(name))[1] = 'qr');
create policy qr_photo_select on storage.objects for select to authenticated
  using (bucket_id = 'docs' and (storage.foldername(name))[1] = 'qr'
         and exists (select 1 from machines mm
                     where mm.id::text = (storage.foldername(name))[2]
                       and (mm.org_id = auth_org_id() or is_superadmin())));

-- ------------------------------------------------------------
-- 2. qr_declare : photo jointe + "peut tourner" ne change plus
--    le statut machine (le mode dégradé reste une décision du
--    responsable maintenance, pas de l'opérateur)
-- ------------------------------------------------------------
drop function if exists qr_declare(uuid, text, text, boolean);
create function qr_declare(qr uuid, p_title text, p_name text, p_can_run boolean default false, p_photo text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_m machines%rowtype; v_token uuid;
begin
  select * into v_m from machines where qr_token = qr;
  if v_m.id is null then
    raise exception 'QR invalide';
  end if;
  insert into interventions (org_id, machine_id, type, priority, title, description, triage, photos)
  values (v_m.org_id, v_m.id, 'curative',
          case when p_can_run then 2 else 3 end,
          p_title,
          'Déclaré via QR code par : ' || coalesce(nullif(p_name,''), 'anonyme')
          || case when p_can_run then ' — la machine peut encore tourner' else ' — machine arrêtée' end,
          'pending',
          case when p_photo is not null
               then jsonb_build_array(jsonb_build_object('path', p_photo, 'name', 'photo opérateur'))
               else '[]'::jsonb end)
  returning track_token into v_token;
  if not p_can_run then
    update machines set status = 'alarm' where id = v_m.id;
  end if;
  return v_token;
end $$;
grant execute on function qr_declare(uuid, text, text, boolean, text) to anon, authenticated;
