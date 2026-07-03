# MaintX — Roadmap / Checklist

Principe directeur (non négociable) : **les gens ont peur des GMAO**. ~70 % des
déploiements échouent sur l'ergonomie, pas les fonctionnalités. Chaque feature doit
simplifier la vie de l'opérateur/technicien, jamais ajouter un champ obligatoire de
plus. En cas de doute : moins de clics, moins de champs, plus gros boutons.

## ✅ Fait

- [x] v0.1–0.3 : auth, multi-tenant, dashboard andon, parc machines, fiche machine
      (specs/docs/historique/QR), page publique QR sans compte, préventif calendaire,
      analyse (downtime, interventions/mois, curatif vs préventif)
- [x] Déploiement GitHub Pages (rudabinks.github.io/maintx)
- [x] UI : menus déroulants custom style atelier (pastilles andon, plus de select natif)
- [x] v0.4 : checklists préventives (validation partielle tracée), photos interventions,
      cause de panne + Pareto, fil de commentaires (patch-v04.sql exécuté)

## ✅ Vague 2 — fondamentaux (v0.5, patch-v05.sql exécuté)

- [x] **Stock de pièces détachées** : page Pièces (réf, nom, emplacement, stock ± ,
      stock mini, coût unitaire), KPI stock bas sur le dashboard, consommation
      saisie dans le détail d'intervention (décrémente le stock, historisée dans
      parts_used)
- [x] **Préventif au compteur d'heures** : compteur manuel sur la fiche machine
      (onglet Infos), gammes "tous les X j ou Y h" avec progression affichée et
      statut COMPTEUR ATTEINT
- [x] **Coût par machine** : pièces consommées + heures d'intervention × taux horaire
      (réglable en Analyse, persisté dans organizations.settings.hourly_rate)

## 🚀 Lot A — jamais vu, gratuit, rapide (aucune IA)

- [ ] **Pizza tracker de panne** : lien public tokenisé après déclaration QR
      ("Vu ✓ → Planifié → En cours → Résolu"), sans compte
- [ ] **Statut "dégradé autorisé"** (MEL aviation) : machine qui tourne sous conditions
      affichées + date limite de réparation + compte à rebours + escalade si dépassée.
      Philosophie du shunt assumé et tracé
- [x] **Fil d'activité unifié par machine** : onglet Activité (interventions, clôtures,
      docs, commentaires dans un fil chronologique) + heatmap 12 mois (1 carré/jour,
      rouge = panne)
- [x] **Score de forme machine 0-100** (computeHealth, sans capteurs) : pannes 30/90 j,
      préventifs en retard, cause récurrente ×3, panne en cours. Jauge + raisons en
      langage simple (onglet Activité) + score sur les cartes du Parc

## 🔁 Lot B — rituels & fidélisation

- [ ] **Brief du lundi** : une seule notification hebdo narrative (cron + LLM léger),
      les urgences andon restent instantanées
- [ ] **Séries préventives** (streaks Duolingo) : "12 semaines sans préventif en
      retard 🔥", badge d'équipe, jamais de flicage individuel
- [ ] **MaintX Rétro** (Spotify Wrapped, décembre) : diaporama animé pour le patron,
      partageable PDF — pub gratuite
- [ ] **Inbox de triage des déclarations QR** (Linear) : Accepter+assigner / Fusionner
      doublon / Reporter / Rejeter, objectif inbox zero

## 🤖 Lot C — IA atelier (Edge Functions Supabase, ~5-8 €/mois/client max)

- [ ] **Mode mains sales** ⭐ priorité de Lilian : le technicien dicte son compte rendu
      (gants/mains sales), Whisper transcrit, LLM structure (compte rendu, cause,
      pièces mentionnées, durée) et remplit le bon d'intervention
- [ ] **Docteur Panne** : photo au moment du scan QR → vision IA propose cause,
      gravité, pré-remplit la déclaration (lit les codes erreur des écrans CN)
- [ ] **Mécano (RAG)** : assistant français qui a lu les manuels uploadés, réponses
      sourcées page à l'appui (pgvector) — la réponse à MaintainX CoPilot à prix PME

## 📦 Backlog (issu de la veille, à prioriser plus tard)

- [ ] Conformité constructeur : référentiel doc constructeur vs gammes réelles,
      écarts couverts/insuffisants/manquants/**shuntés avec raison obligatoire**,
      score par machine (idée fondatrice de Lilian) ; phase 2 : extraction IA du PDF
- [ ] Remise en service à double signature (checklist chirurgicale OMS) : technicien
      + opérateur valident avant retour en production
- [ ] Cahier de passation d'équipe pré-rempli (shift logbook restauration)
- [ ] Mise en kit d'intervention (kitting logistique) : pièces/outils/EPI cochés
      avant de passer "en cours"
- [ ] Pannes épinglées sur plan d'atelier (Fieldwire) — floorplan_url existe déjà
- [ ] Post-mortem guidé après panne critique (timeline auto + 3 questions + PDF audit)
- [ ] Cycle de maintenance hebdo avec report auto + badge "reporté 3×" (Linear Cycles)
- [ ] Automatisations no-code en français "quand X alors Y" (Notion)
- [ ] Palette de commandes Ctrl+K + recherche universelle mobile
- [ ] Bibliothèque de gammes par famille de machine (pré-remplie par Lilian à chaque
      setup → setups de plus en plus rapides)
- [ ] Annotation des photos (flèches, cercles, texte — canvas simple) : feature la
      plus citée en positif par les techniciens
- [ ] Export CSV/Excel sur toutes les listes (machines, interventions, pièces)
- [ ] Sous-ensembles machine (ligne → machine → organe) : hiérarchie 3 niveaux mini
- [ ] Mode hors-ligne avec synchronisation (zones d'atelier sans wifi)
- [ ] Import CSV du parc machines
- [ ] Création des comptes utilisateurs clients depuis l'admin superadmin
- [ ] Migration Vite + React multi-fichiers (même design/comportement)
- [ ] Facturation Stripe
- [ ] Plan Connect : ingestion machine_events + TRS (FOCAS/MTConnect, alternance
      Dreamtech)

## 📜 Règles produit (retours terrain, agents juillet 2026)

Insight central : les gens n'ont pas peur des GMAO, ils ont peur de la **saisie**
et des outils conçus pour la direction. Le concurrent réel = Excel + WhatsApp + papier.
L'argument gagnant : "montre en 2 mois que c'est plus rapide que ton tableur".

- Déclarer une intervention : **< 30 secondes, 3 champs max** (titre, machine, photo)
- Historique machine accessible en 1 tap (fait : onglets fiche machine + fil d'activité)
- Photos annotables (flèches, texte) = la feature la plus aimée des techniciens → backlog
- Export Excel/CSV partout (rassure contre le lock-in) → backlog
- Parité mobile/desktop + tester avec police système agrandie (techniciens âgés)
- Checklists cochables au point d'intervention avec preuve photo légère
  (anti "pencil whipping" : cocher sans faire)
- Démarrer un client avec 10 machines et enrichir au fil de l'eau — jamais exiger
  une migration parfaite avant le go-live (les projets calent à 75-80 %)
- Performance irréprochable : une app qui rame = avis assassins + abandon

## 💼 Règles business (setup = le produit)

- ~40 % des PME abandonnent leur GMAO en < 18 mois ; cause n°1 : la préparation.
  Le setup payant sur site EST le produit ("GMAO opérationnelle en 30 jours")
- Reprendre max 2 ans d'historique au setup, archiver le reste
- Identifier un "technicien relais" chez le client et le former en premier
- Rendez-vous de suivi à J+30 et J+90 (le désengagement se joue au début)
- Forfait atelier (150 €/mois) confirmé — jamais de prix par utilisateur, jamais
  de hausse surprise en année 2, jamais de freemium bridé
- Support téléphonique direct = différenciateur imbattable pour un solo (cf. Bob! Desk)
- Pitch : audit ISO 9001 (traçabilité) + pannes chiffrées en € (graphique coûts)
- Afficher "données hébergées en Europe" (vérifier la région du projet Supabase,
  clause de réversibilité/export dans le contrat)

## ⚠️ Anti-patterns à éviter (confirmés par les avis utilisateurs)

- Champs obligatoires superflus = "taxe de saisie" → saisies bidon ou abandon
- Workflows d'approbation multi-niveaux → "pocket veto" : on répare sans tracer.
  Aucune approbation par défaut en petite équipe
- Concevoir pour le manager d'abord ("designed for management, not boots on ground"
  = LA raison de la haine des GMAO) — les dashboards viennent après le terrain
- Tout activer au jour 1 → complexité perçue, désengagement en 30 jours
- Vendre du prédictif/IoT à des ateliers de 5-50 machines (jamais utilisé ;
  notre score de forme heuristique suffit)
- Interdire l'édition après clôture, pas d'édition en masse (reproches MaintainX)
- Notifier chaque événement → tout finit ignoré (préférer le Brief du lundi)
- Leaderboard individuel → flicage (préférer les séries d'équipe)
- Double saisie papier + appli (premier reproche des techniciens)
- Rapports PDF austères que personne ne lit (préférer Rétro + Brief narratif)
