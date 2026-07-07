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
- [x] v0.7 : page QR — question "la machine peut-elle encore tourner ?" : oui →
      statut dégradé (jaune, priorité 2), non → panne (rouge, priorité 3)
      (patch-v07.sql : qr_declare avec p_can_run)
- [x] v0.8 : étape "Prise en compte" dans le suivi public (bouton 👁 côté
      technicien, auto si changement de statut ; patch-v08.sql : acked_at)
      + dictée vocale sur la page QR (Web Speech, remplit la description)

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

- [x] **Pizza tracker de panne** : page publique #/suivi/<token> après déclaration QR
      (Déclarée → En réparation / Attente pièces → Réparée), sans compte,
      rafraîchissement auto 30 s (patch-v06.sql : track_token + qr_track)
- [x] **Statut "dégradé autorisé"** (MEL aviation) : 5e statut andon jaune, conditions
      d'exploitation obligatoires + date limite, bandeau compte à rebours J−x sur la
      fiche, alerte rouge dashboard si dépassé, −8 au score de forme
      (patch-v06.sql : contrainte status + degraded_conditions/deadline)
- [x] **Fil d'activité unifié par machine** : onglet Activité (interventions, clôtures,
      docs, commentaires dans un fil chronologique) + heatmap 12 mois (1 carré/jour,
      rouge = panne)
- [x] **Score de forme machine 0-100** (computeHealth, sans capteurs) : pannes 30/90 j,
      préventifs en retard, cause récurrente ×3, panne en cours. Jauge + raisons en
      langage simple (onglet Activité) + score sur les cartes du Parc

## ✅ Lot B — rituels & fidélisation (v0.9)

- [x] **Brief du lundi** : bandeau dashboard généré par IA (Edge Function
      weekly-brief, 45 mots max), 1×/semaine, caché dans settings.weekly_brief
- [x] **MaintX Rétro** : diaporama plein écran depuis Analyse (interventions,
      machine la plus capricieuse, cause n°1, heures d'arrêt, coût, merci équipe)
- [x] **Inbox de triage des QR** (Linear) : vue "À trier" avec badge, Accepter /
      Doublon (fusion, le suivi public suit le maître) / Reporter (priorité basse) /
      Rejeter (fausse alerte, machine remise en marche) — patch-v09.sql
- ~~Séries préventives (streaks)~~ : écarté par Lilian ("pas sérieux") — au backlog
      si un client le demande

## 🤖 Lot C — IA atelier (Edge Functions Supabase, ~5-8 €/mois/client max)

- [x] **Mode mains sales** ⭐ (v0.7) : dictée navigateur (Web Speech, gratuite,
      Chrome/Edge/mobile ; saisie clavier en secours sur Firefox) → Edge Function
      voice-report (Claude Haiku) → compte rendu structuré proposé (résumé, cause,
      réparé ou non, pièces, reste à faire) que le technicien valide en 1 tap.
      ⚠ Déploiement requis : fonction voice-report + secret ANTHROPIC_API_KEY
- ~~Docteur Panne (diagnostic IA par photo)~~ : abandonné — l'IA n'a pas le contexte
      machine, un diagnostic faux avec assurance tue la confiance (décision Lilian).
      Reste envisageable en factuel pur : lecture de code erreur / plaque signalétique
- [x] **Déjà-vu** (v0.11, sans IA) : encadré jaune dans le détail d'une panne en cours,
      3 pannes passées les plus proches de la même machine (mots du titre en commun),
      avec date, cause, pièces utilisées — la mémoire de l'atelier qui diagnostique
- [~] **Mécano** — MASQUÉ (v0.14c, décision Lilian : "plus tard"). Onglet retiré,
      auto-indexation + boutons 🧠 retirés des Documents. Code conservé en dormance
      (composant Mecano, db.ingestDoc, doc_chunks, mecano-ask=swift-api) : rebranchable
      en ~2 min. Les **Documents restent actifs** (valeur métier sans IA).
      Détail d'origine (v0.12) : PDF indexés page par page,
      réponses UNIQUEMENT depuis les extraits avec source "(doc, p. X)" (mecano-ask
      = slug swift-api, Haiku), "je ne trouve pas dans la doc" sinon — patch-v11.sql.
      v0.14b : extraction PDF déplacée côté navigateur (pdf.js CDN) car l'Edge
      Function doc-ingest plantait en 546 (limite mémoire ~150 Mo sur gros PDF) ;
      insertion directe dans doc_chunks via RLS. La fonction doc-ingest n'est plus
      utilisée. La réponse à MaintainX CoPilot à prix PME

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
- [ ] Nom définitif du produit + logo (MaintX = nom de travail) — brainstormer plus tard
- [ ] Refonte visuelle "GMAO pro industrielle" (en cours) : mur de machines (C),
      interventions tableau dense + bascule liste/tableau/kanban (A+B), Accueil KPI +
      tableau dense ; liste simple sur mobile. Maquettes validées avec Lilian
- [ ] Améliorations du rapport hebdo PDF (mise en page, graphiques, envoi par mail)
- [ ] Annotation des photos (flèches, cercles, texte — canvas simple) : feature la
      plus citée en positif par les techniciens
- [ ] Export CSV/Excel sur toutes les listes (machines, interventions, pièces)
- [ ] Sous-ensembles machine (ligne → machine → organe) : hiérarchie 3 niveaux mini
- [ ] Mode hors-ligne avec synchronisation (zones d'atelier sans wifi)
- [x] Import CSV du parc machines (v0.13) : bouton "⤒ Importer CSV" dans le Parc,
      coller depuis Excel ou fichier .csv, détection séparateur (;/,/tab) + en-têtes
      accentués, criticité 1-3 ou texte, aperçu avant import, insertion en masse
- [x] Comptes clients (v0.14) : inscription libre (nom, entreprise, email, mdp) →
      profil "en attente" (trigger handle_new_user) → superadmin autorise dans Admin
      (affecte org + rôle) ou refuse. Écran "en attente" tant que non validé,
      badge sur le menu Admin — patch-v13.sql
- [ ] Migration Vite + React multi-fichiers (même design/comportement)
- [ ] Facturation Stripe
- [ ] Plan Connect : ingestion machine_events + TRS (FOCAS/MTConnect, alternance
      Dreamtech). Lilian A DÉJÀ un système FOCAS qui récupère en temps réel l'état
      actif/inactif du parc → à brancher ensemble (ingestion machine_events).
      Idée production/argent : "pas déclaré en panne = ça tourne = ça produit" comme
      proxy manuel en attendant ; version fiable = temps de fonctionnement réel FOCAS
      × taux €/h → valeur produite mise en avant sur le dashboard
- [ ] Auto-hébergement : Supabase self-hosted sur serveur perso de Lilian (long terme ;
      hébergement UE Supabase confirmé en attendant — argument RGPD actif)

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
