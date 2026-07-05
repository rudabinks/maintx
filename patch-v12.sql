-- ============================================================
-- MaintX v0.12b — Patch sécurité (suite Security Advisor)
-- À exécuter dans SQL Editor de Supabase
-- ============================================================

-- Les helpers RLS n'ont pas besoin d'être appelables par les anonymes
revoke execute on function auth_org_id() from public, anon;
revoke execute on function is_superadmin() from public, anon;
grant execute on function auth_org_id() to authenticated;
grant execute on function is_superadmin() to authenticated;

-- Les fonctions QR restent volontairement ouvertes au rôle anon
-- (c'est la feature "déclarer/suivre une panne sans compte"),
-- mais on retire le grant générique "public"
revoke execute on function qr_declare(uuid, text, text, boolean, text) from public;
revoke execute on function qr_get_machine(uuid) from public;
revoke execute on function qr_track(uuid) from public;
