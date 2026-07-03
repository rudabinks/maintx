-- ============================================================
-- MaintX — Initialisation de ton compte superadmin
-- ============================================================
-- ÉTAPE 1 (dashboard, pas SQL) :
--   Authentication → Users → "Add user" → "Create new user"
--   Email : lilianbennetpro@gmail.com (ou autre)
--   Mot de passe : choisis-le
--   Coche "Auto Confirm User" si proposé.
--
-- ÉTAPE 2 : exécute ce script dans SQL Editor.
-- Il crée ton profil superadmin + une première org de test.
-- ============================================================

-- Ton profil superadmin (récupère automatiquement ton user id)
insert into profiles (id, org_id, full_name, role)
select id, null, 'Lilian Bennet', 'superadmin'
from auth.users
where email = 'lilianbennetpro@gmail.com'   -- ⚠ adapte si autre email
on conflict (id) do update set role = 'superadmin';

-- Une organisation de démo pour tester
insert into organizations (name, slug, plan)
values ('Atelier Démo', 'atelier-demo', 'standard')
on conflict (slug) do nothing;

-- Vérification
select p.full_name, p.role, u.email
from profiles p join auth.users u on u.id = p.id;
