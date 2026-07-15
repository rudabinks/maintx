# MaintX — Document de passation (contexte complet)

> À coller / donner en début d'une nouvelle discussion pour repartir avec tout le contexte.
> Dernière mise à jour : 2026-07-11.

---

## 1. Le projet en 30 secondes
**MaintX** = GMAO SaaS low-cost pour PME industrielles (ateliers de 5–50 machines qui gèrent
encore la maintenance sur Excel/papier). Fondateur : **Lilian Bennet**, apprenti maintenance
industrielle (alternance Dreamtech, master ENI numérisation industrielle).

**Business model :**
- Mise en service (setup) sur site : ~1000 € (variable selon les technos déjà en place).
  **Offerte pour le 1er client** (son atelier d'alternance, car il apprend sur site).
- Abonnement par atelier : **Standard ~180 €/mois** (GMAO complète) ·
  **Connect ~300 €/mois** (+ état machines temps réel via FOCAS).
- 1 site = 1 abonnement (forfait, jamais par utilisateur).

**En ligne :** https://maintx.fr · Repo : https://github.com/rudabinks/maintx (pseudo GitHub : rudabinks)

---

## 2. Architecture (IMPORTANT à comprendre)
- **Frontend** : React 18 UMD + Babel standalone + supabase-js via CDN. **AUCUN build tool,
  Node PAS requis.** Le code est découpé dans `src/*.jsx` (source de vérité) et **réassemblé**
  dans `index.html` (fichier déployé) par `bash build.sh` (simple concaténation).
  Tout est dans un seul scope global → pas d'import/export.
- **Hébergement frontend** : GitHub Pages (sert `index.html`). Domaine `maintx.fr` (acheté chez OVH).
- **Backend** : Supabase (cloud UE) — base PostgreSQL + Auth + Storage + Edge Functions.
  - URL : `https://krfrzuxdymgzttkdcaab.supabase.co`
  - Clé publishable (publique, OK dans le code) : `sb_publishable_KXSWUiTsFqU6aDf67rF51g_t_px3jkt`
- **IA** : Edge Functions Supabase appellent l'API Claude (Anthropic). Modèle : `claude-haiku-4-5-20251001`.
- **Email** : Resend (compte de Lilian), domaine `maintx.fr` vérifié (SPF/DKIM/DMARC dans OVH Zone DNS).

## 3. Workflow de dev (NE JAMAIS OUBLIER)
1. Éditer les fichiers `src/*.jsx` — **JAMAIS `index.html` directement**.
2. Lancer `bash build.sh` → régénère `index.html`.
3. `git add -A && git commit && git push`. GitHub Pages redéploie tout seul (~1-2 min).
Fichiers src (dans l'ordre de concaténation) : `_head.html` (head+CSS), `10-config` (config,
constantes, helpers), `20-public` (Root/QR/Login), `30-app` (App + db + nav), `40-dashboard`,
`50-machines`, `60-preventif`, `70-admin-triage`, `75-planning`, `80-pieces-analyse`,
`85-ui` (Dropdown/Kpi…), `90-interventions`, `95-modals`, `_tail.html`.

## 4. Edge Functions — PIÈGE DES SLUGS
Supabase donne un **slug aléatoire** à chaque déploiement (le renommage ne change pas l'URL).
Ne PAS redéployer une fonction sans raison. Mapping actuel dans la constante `FN` (`src/10-config.jsx`) :
| Rôle | Slug déployé |
|------|--------------|
| Dictée mode mains sales (`voice-report`) | `voice-report` |
| Brief du lundi (`weekly-brief`) | `rapid-function` |
| Mécano RAG (`mecano-ask`) | `swift-api` |
| Directives IA planning (`plan-directive`) | `quick-function` |
| Email planning (`send-plan`) | `swift-task` |

**Secrets Supabase (Edge Functions) :** `ANTHROPIC_API_KEY`, `RESEND_API_KEY`.

## 5. Base de données
Patches SQL exécutés jusqu'à **patch-v14** (voir fichiers `schema.sql` + `patch-v03..v14.sql`).
Tables : organizations, profiles (rôles operator/technician/manager/superadmin), zones, machines,
interventions, preventive_plans, machine_events, machine_documents, parts, intervention_comments,
doc_chunks. RLS stricte par org_id (`auth_org_id()`, `is_superadmin()` en security definer).

---

## 6. Fonctionnalités LIVRÉES
- **Fondamentaux** : parc machines, interventions (curatif/préventif/amélioratif), préventif
  (calendaire + au compteur d'heures, checklists, groupé par tâche, validation en lot,
  filtre "à faire"), pièces détachées (stock, alerte), coûts par machine.
- **Multi-tenant** : superadmin (Lilian) switch entre clients ; **inscription libre + validation**
  par le superadmin (affecte org + rôle) ; **gestion par usine** (Admin : utilisateurs, rôles,
  logo, formule, zones/ateliers) ; **import CSV** du parc.
- **Terrain / QR** : déclaration de panne par QR **sans compte** (dictée vocale + photo +
  "la machine peut-elle tourner ?"), **suivi public** de la réparation (4 étapes, sans compte),
  statut **"dégradé autorisé"** (MEL aviation, compte à rebours), **impression QR en A4** (toutes
  les machines d'un coup). Technicien connecté qui scanne → **espace technicien** (dictée directe).
- **IA** : **mode mains sales** (dictée → compte rendu structuré), **brief du lundi** (+ PDF),
  **Rétro annuelle**, **Mécano** (assistant qui a lu les manuels PDF — indexé côté navigateur,
  actuellement MASQUÉ), **Déjà-vu** (pannes passées similaires, sans IA).
- **Analyse & suivi** : Pareto des causes, coût/machine, **score de forme machine** (0-100 sans
  capteurs), heatmap 12 mois, fil d'activité par machine.
- **Planning** (responsable maintenance) : agenda, planifier une intervention (machine, technicien,
  date), **directives générées par IA**, **email auto au technicien** (via Resend) avec pièce
  jointe **.ics** (ajout à l'agenda en 1 clic). Verrou anti double-envoi en place.
- **UX pro** : mur de machines (salle de contrôle), interventions liste/tableau/kanban,
  navigation en bandeau haut (desktop) + barre du bas (mobile), icônes Font Awesome, triage des
  demandes QR fusionné dans Interventions, alertes acquittables. Technicien atterrit sur Interventions.
- **Conformité** : pages Mentions légales + Confidentialité (RGPD), données hébergées UE.

## 7. À FAIRE / backlog (par priorité approximative)
- **Page QR plus "pro"** : enlever les emojis résiduels, look GMAO sérieux (Lilian n'aime pas le côté "IA/Claude").
- **Fluidité** des écrans interventions (lire/modifier plus facilement).
- **Interfaces par rôle** (grande feature) : opérateur = déclarer seulement ; directeur/planificateur
  = état machines + interventions en cours/à venir + créer des interventions futures ; maintenance
  = tout + suppression ; responsable = la page Planning (déjà faite).
- **Plan Connect / FOCAS temps réel — pilote EN COURS (2026-07)** : les CN de l'atelier de Lilian
  sont toutes Fanuc, en réseau, déjà lues par **JITbase** (surveillance machines) → le réseau est OK.
  Choix : FOCAS en direct (pas l'API JITbase) pour que MaintX soit autonome et vendable partout.
  Livré : `patch-v15.sql` + Edge Function `connect-ingest` + agent `gateway/maintx_gateway.py`
  (modes sim/focas, voir `gateway/README.md`). RESTE : exécuter le patch, déployer la fonction
  (décocher Verify JWT, noter le slug → config.json), test mode sim.
  ⚠️ **2026-07-15 : pilote sur l'atelier d'alternance REFUSÉ par Arnaud Bouet** (position : sujet
  à traiter en projet GMAO groupe, pas en développement personnel — l'atelier a déjà JitBase).
  Ne plus rien déployer ni utiliser sur site. Conséquence assumée : chercher un atelier pilote
  dans la VRAIE cible (PME 5-50 machines sur Excel/papier, sans service info) ; le dev Connect
  continue en mode simulation, tout reste prêt pour le premier vrai client.
- **Conformité constructeur** (idée fondatrice) : comparer préconisations constructeur vs gammes
  réelles, écarts assumés "shuntés", score par machine.
- **Réactiver Mécano** (code dormant), export Excel, annotation photos, sous-ensembles machine, hors-ligne.
- **Auto-hébergement** : un ami de Lilian (sysadmin pro, Toulouse) peut héberger → Supabase self-hosted
  plus tard (souveraineté données FR). Le domaine `maintx.fr` rend la migration indolore (QR inchangés).
- **Nom + logo définitifs** (MaintX = nom de travail, gardé pour l'instant).
- Facturation Stripe ; création micro-entreprise (statut légal) quand 1re vente concrète.

## 8. Comment travailler avec Lilian
- Débutant en git/GitHub/Supabase mais exécute très bien des **instructions précises** (URL directe +
  quoi cliquer/coller). Utilise **Firefox**, se connecte à GitHub via Google.
- **Sa frustration n°1 : "ne pas voir le fil"** → tenir un tableau de bord clair, rappeler où on en est.
- Veut **avancer vite, agir directement** (moins de questions/maquettes non demandées), demandes groupées,
  checklists de test courtes. Réponses **en français, concises, livrables d'abord**.
- A autorisé le lancement d'**agents IA de veille** en autonomie quand pertinent.
- Après le découpage du code : on peut lancer **plusieurs agents en parallèle** sur des fichiers différents.

## 9. Ressources
- Tableau de bord projet (Artifact, à rouvrir/mettre à jour) : voir le lien partagé en session.
- Fiche de présentation commerciale A4 (Artifact) : idem.
- CLAUDE.md (instructions projet) + ROADMAP.md (backlog détaillé + règles produit/business + anti-patterns)
  sont dans le repo et font foi.
