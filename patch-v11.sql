-- ============================================================
-- MaintX v0.12 — Patch SQL (Mécano : l'assistant qui a lu les manuels)
-- À exécuter dans SQL Editor de Supabase
-- ============================================================

-- Extraits de documents, indexés pour la recherche plein-texte française
create table if not exists doc_chunks (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references organizations(id) on delete cascade,
  machine_id  uuid not null references machines(id) on delete cascade,
  document_id uuid not null references machine_documents(id) on delete cascade,
  doc_name    text not null,
  page        int,
  content     text not null,
  tsv         tsvector generated always as (to_tsvector('french', content)) stored
);
alter table doc_chunks enable row level security;
create policy org_chunks on doc_chunks
  for all using (org_id = auth_org_id() or is_superadmin());
create index if not exists idx_chunks_tsv on doc_chunks using gin (tsv);
create index if not exists idx_chunks_machine on doc_chunks (machine_id);

-- Marqueur d'indexation sur les documents
alter table machine_documents add column if not exists indexed_at timestamptz;
