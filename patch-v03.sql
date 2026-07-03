-- ============================================================
-- MaintX v0.3 — Patch SQL
-- Documents machines + Storage + déclaration publique par QR
-- À exécuter dans SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. DOCUMENTS PAR MACHINE
-- ------------------------------------------------------------
create table if not exists machine_documents (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  machine_id   uuid not null references machines(id) on delete cascade,
  category     text not null default 'maintenance'
               check (category in ('electrique','pneumatique','hydraulique','maintenance','autre')),
  name         text not null,
  storage_path text not null,
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);
alter table machine_documents enable row level security;
create policy org_docs on machine_documents
  for all using (org_id = auth_org_id() or is_superadmin());
create index if not exists idx_docs_machine on machine_documents (machine_id);

-- ------------------------------------------------------------
-- 2. STORAGE — bucket privé 'docs', chemin = org_id/machine_id/fichier
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('docs', 'docs', false)
on conflict (id) do nothing;

create policy docs_select on storage.objects for select
  using (bucket_id = 'docs' and ((storage.foldername(name))[1] = auth_org_id()::text or is_superadmin()));
create policy docs_insert on storage.objects for insert
  with check (bucket_id = 'docs' and ((storage.foldername(name))[1] = auth_org_id()::text or is_superadmin()));
create policy docs_delete on storage.objects for delete
  using (bucket_id = 'docs' and ((storage.foldername(name))[1] = auth_org_id()::text or is_superadmin()));

-- ------------------------------------------------------------
-- 3. QR PUBLIC — deux fonctions sécurisées pour la page de scan
--    (accessibles sans compte, limitées au strict nécessaire)
-- ------------------------------------------------------------
create or replace function qr_get_machine(qr uuid)
returns table(id uuid, name text, code text, family text, org_name text)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.code, m.family, o.name
  from machines m join organizations o on o.id = m.org_id
  where m.qr_token = qr
$$;
grant execute on function qr_get_machine(uuid) to anon, authenticated;

create or replace function qr_declare(qr uuid, p_title text, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_m machines%rowtype;
begin
  select * into v_m from machines where qr_token = qr;
  if v_m.id is null then
    raise exception 'QR invalide';
  end if;
  insert into interventions (org_id, machine_id, type, priority, title, description)
  values (v_m.org_id, v_m.id, 'curative', 2, p_title,
          'Déclaré via QR code par : ' || coalesce(nullif(p_name,''), 'anonyme'));
  update machines set status = 'alarm' where id = v_m.id;
end $$;
grant execute on function qr_declare(uuid, text, text) to anon, authenticated;
