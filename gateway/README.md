# MaintX Gateway — passerelle atelier (plan Connect)

Petit agent qui lit l'état des CN Fanuc (FOCAS) et pousse les événements
run / stop / alarme vers MaintX. L'andon du dashboard passe au rouge tout
seul, sans que personne ne scanne quoi que ce soit.

```
CN Fanuc ──TCP 8193 (FOCAS, lecture seule)──▶ VM atelier (ce script)
                                                 │ HTTPS sortant uniquement
                                                 ▼
                                  Edge Function connect-ingest (Supabase)
                                                 │
                                     machine_events + statut andon
```

## Mise en route (une seule fois)

1. **SQL** : exécuter `patch-v15.sql` dans Supabase → SQL Editor.
2. **Edge Function** : Supabase → Edge Functions → *Deploy new function* →
   nom `connect-ingest`, coller `supabase/functions/connect-ingest/index.ts`.
   ⚠️ **Décocher "Verify JWT"** (l'authentification se fait par `x-connect-key`).
   Noter le **slug** attribué → c'est lui qui va dans `ingest_url` du config.
3. **Récupérer la connect_key** de l'organisation (SQL Editor) :
   ```sql
   select name, connect_key from organizations;
   ```
4. Sur la machine qui exécute l'agent : installer **Python 3** (python.org,
   cocher "Add to PATH"). Aucune bibliothèque à installer.
5. Copier `config.example.json` → `config.json`, remplir `ingest_url` +
   `connect_key`. **Ne jamais commiter `config.json`** (déjà dans .gitignore).
6. Lister les machines et copier leurs `machine_id` dans le config :
   ```
   python maintx_gateway.py --machines
   ```

## Test de la chaîne complète (mode simulation, sans CN)

Dans `config.json` : `"mode": "sim"` et `"alarm_min_seconds": 0` (pour ne pas
attendre 60 s la confirmation de panne). Puis :

```
python maintx_gateway.py
```

→ ouvrir maintx.fr : les pastilles andon changent toutes seules, les pannes
simulées apparaissent. `Ctrl+C` pour arrêter. (Événements marqués `source:
"sim"` dans machine_events — purgeables avec
`delete from machine_events where source = 'sim';`)

## Passage en réel (sur la VM atelier)

1. `"mode": "focas"`, `"alarm_min_seconds": 60`, renseigner les **IP des CN**.
2. Poser la bibliothèque FOCAS de Fanuc à côté du script :
   `fwlib64.dll` (Windows 64 bits) ou `fwlib32.dll` (32 bits) ou
   `libfwlib32.so` (Linux).
3. `python maintx_gateway.py --dry-run` pour vérifier la lecture des CN
   sans rien envoyer, puis sans `--dry-run`.
4. Démarrage automatique : Planificateur de tâches Windows ("Au démarrage",
   `python C:\...\maintx_gateway.py`) ou service systemd sous Linux.

## Comportement

- N'envoie que les **changements** d'état (pas de spam).
- Une alarme ne devient une **panne** que si sa catégorie est "sérieuse"
  (`alarm_types_panne` : servo SV, broche SP, surchauffe OH, alarme
  constructeur MC, surcourse OT, power PW — les erreurs programme PS sont
  ignorées) **et** qu'elle persiste `alarm_min_seconds`. Sinon = simple arrêt.
- Machine en statut `maintenance` dans MaintX : jamais écrasée par la passerelle.
- Internet coupé : événements bufferisés dans `pending.jsonl`, renvoyés
  automatiquement au retour du réseau.
- Lecture seule : l'agent n'écrit jamais rien vers les CN.
