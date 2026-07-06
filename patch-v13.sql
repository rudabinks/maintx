-- ============================================================
-- MaintX v0.14 — Patch SQL
-- Inscription libre + validation par le superadmin
-- À exécuter dans SQL Editor de Supabase
-- ============================================================

-- Profil "en attente" tant que le superadmin n'a pas validé
alter table profiles add column if not exists pending boolean not null default false;
-- Nom d'entreprise saisi à l'inscription (indice pour l'affectation)
alter table profiles add column if not exists requested_org text;

-- À chaque inscription, on crée automatiquement un profil en attente
-- (SECURITY DEFINER : contourne la RLS pour l'insertion système)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, role, pending, requested_org)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'full_name',''), new.email),
          'operator', true,
          new.raw_user_meta_data->>'requested_org')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
