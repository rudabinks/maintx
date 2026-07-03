# MaintX — GMAO SaaS pour PME industrielles

## Contexte
Projet de Lilian Bennet (apprenti maintenance industrielle → Master ENI numérisation industrielle).
Objectif : GMAO SaaS low-cost pour PME/ateliers de 5 à 50 machines qui gèrent encore la
maintenance sur Excel/papier. Business model :
- Setup one-shot payant (1 500–3 000 €) : Lilian configure tout chez le client
  (parc machines, QR codes imprimés/collés, gammes préventives, formation 1 h)
- Abonnement 150 €/mois (hébergement, support, MàJ)
- Futur plan "Connect" 250–300 €/mois : monitoring machines (FOCAS/MTConnect/boîtier IoT)
  — PAS encore développé, mais la table machine_events existe déjà pour ça.

## Stack
- Frontend : actuellement UN SEUL fichier `index.html` (React 18 UMD + Babel standalone
  + supabase-js UMD via CDN). Migration prévue vers Vite + React multi-fichiers.
- Backend : Supabase (Postgres + Auth + Storage + RLS)
  - URL : https://krfrzuxdymgzttkdcaab.supabase.co
  - Clé publishable (publique, OK dans le code client) :
    sb_publishable_KXSWUiTsFqU6aDf67rF51g_t_px3jkt
- Déploiement : GitHub Pages (site statique).

## Base de données (voir schema.sql + patch-v03.sql + patch-v04.sql)
Tables : organizations (tenants), profiles (rôles : operator/technician/manager/superadmin),
zones, machines, interventions, preventive_plans, machine_events, machine_documents.
Vues : v_kpi_machine, v_chronic_failures (avec security_invoker = true).
- RLS strict : isolation par org_id via auth_org_id() ; superadmin (Lilian) voit tout.
- ⚠ Les fonctions auth_org_id() et is_superadmin() DOIVENT être `security definer`
  (sinon récursion infinie du RLS sur profiles — déjà corrigé, ne pas régresser).
- Storage : bucket privé `docs`, chemin `org_id/machine_id/fichier`, policies par org.
- QR public : fonctions RPC `qr_get_machine(qr)` et `qr_declare(qr, p_title, p_name)`
  en security definer, accessibles au rôle anon. La déclaration passe la machine en `alarm`.

## Fonctionnalités actuelles (v0.4)
- Auth email/mot de passe. Comptes créés par l'admin (pas d'inscription publique).
- Multi-tenant : superadmin switch entre clients, crée des orgs depuis l'onglet Admin.
- Dashboard : bandeau "andon" (pastilles type colonne lumineuse, clignote si panne),
  KPI (pannes, interventions ouvertes, MTTR calculé sur started_at/finished_at,
  préventifs en retard), alerte panne chronique (3+ curatifs / 90 j).
- Parc machines : criticité 1-3 (Secondaire/Importante/Critique), familles libres.
- Fiche machine (4 onglets) : Specs techniques libres clé/valeur (meta.specs jsonb),
  Documents par catégorie (électrique/pneumatique/hydraulique/maintenance/autre),
  Historique interventions, QR code avec étiquette imprimable.
- Page publique #/qr/<token> : déclaration de panne sans compte (mobile-first).
- Préventif : création de gammes (périodicité en jours), bouton "Fait" → replanifie
  next_due et trace une intervention preventive done.
- Analyse : bar charts SVG maison (Pareto des causes de panne, downtime par machine,
  interventions/mois, répartition curatif/préventif).
- v0.4 : checklists dans les gammes préventives (cochées à la validation, tracées
  dans l'intervention même si partielles), photos sur interventions (bucket docs,
  chemin org_id/machine_id/interventions/id_intervention/), cause de panne sur les
  curatifs (failure_cause : mecanique/electrique/pneumatique/hydraulique/
  cn_automatisme/autre), fil de commentaires (table intervention_comments).
- UI : menus déroulants custom (composant Dropdown, pastilles andon colorées,
  surlignage jaune) — plus aucun <select> natif.

## Design (à préserver)
Identité "atelier" : fond gris béton #EBECEE, encre #1B1D21, accent jaune sécurité
#FFC400, statuts vert #1FA254 / orange #E8940A / rouge #D63B2F.
Titres 'Arial Black' uppercase. Élément signature : pastilles "andon" verticales.
Interface 100 % en français.

## Roadmap
Voir ROADMAP.md (checklist complète : vague 2 fondamentaux, lots A/B/C issus de la
veille inter-sectorielle, backlog, anti-patterns à éviter). Principe : les gens ont
peur des GMAO — toujours simple et ergonomique, moins de clics, moins de champs.

## Conventions
- Réponses et UI en français. Style d'échange : direct, concis, livrables d'abord.
- Un client Supabase unique, jamais la clé service_role côté client.
- Toute nouvelle table : RLS activé + policy org_id = auth_org_id() or is_superadmin().
