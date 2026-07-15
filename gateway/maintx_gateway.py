# ============================================================
# MaintX Gateway — passerelle atelier (plan Connect)
# Lit l'état des CN Fanuc via FOCAS (fwlib) et pousse les
# événements run/stop/alarm vers Supabase (Edge Function
# connect-ingest). Python 3.9+, aucune dépendance externe.
#
# Modes (champ "mode" du config.json) :
#   "sim"   : machines simulées — teste toute la chaîne sans CN
#   "focas" : lecture réelle des CN (fwlib32.dll / libfwlib32.so
#             à placer à côté de ce script)
#
# Usage :
#   python maintx_gateway.py               # boucle de supervision
#   python maintx_gateway.py --machines    # liste id/nom des machines
#                                          # (pour remplir le config)
#   python maintx_gateway.py --dry-run     # n'envoie rien, affiche
#
# Robustesse : n'envoie que les CHANGEMENTS d'état ; si internet
# coupe, les événements sont mis en attente dans pending.jsonl et
# renvoyés au retour du réseau.
# ============================================================

import ctypes
import json
import os
import random
import sys
import time
import urllib.request
from ctypes import c_char, c_long, c_short, c_ushort
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "config.json")
PENDING_PATH = os.path.join(HERE, "pending.jsonl")

# Types d'alarme FOCAS (cnc_rdalmmsg2) — séries 30i/31i/32i/0i
ALARM_TYPES = {
    0: "SW", 1: "PW", 2: "IO", 3: "PS", 4: "OT", 5: "OH", 6: "SV",
    7: "SR", 8: "MC", 9: "SP", 10: "DS", 11: "IE", 12: "BG", 13: "SN",
    15: "EX",
}

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------
def load_config():
    if not os.path.exists(CONFIG_PATH):
        sys.exit("config.json introuvable — copier config.example.json en config.json et le remplir.")
    with open(CONFIG_PATH, encoding="utf-8") as f:
        cfg = json.load(f)
    for k in ("ingest_url", "connect_key", "machines"):
        if not cfg.get(k):
            sys.exit(f"config.json : champ '{k}' manquant.")
    cfg.setdefault("mode", "sim")
    cfg.setdefault("poll_seconds", 5)
    # Types d'alarme considérés comme PANNE (le reste = arrêt simple) :
    # SV servo, SP broche, OH surchauffe, MC alarme constructeur (PMC),
    # OT surcourse, PW power-off. PS (erreur programme) volontairement exclu.
    cfg.setdefault("alarm_types_panne", ["SV", "SP", "OH", "MC", "OT", "PW"])
    # Une alarme doit persister X secondes avant de déclarer la panne
    # (évite les faux positifs sur un reset immédiat de l'opérateur)
    cfg.setdefault("alarm_min_seconds", 60)
    return cfg


# ------------------------------------------------------------
# Envoi vers Supabase (avec file d'attente hors-ligne)
# ------------------------------------------------------------
def post_json(url, key, payload, timeout=15):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-connect-key": key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))

def queue_pending(events):
    with open(PENDING_PATH, "a", encoding="utf-8") as f:
        for e in events:
            f.write(json.dumps(e) + "\n")

def flush_pending(cfg):
    if not os.path.exists(PENDING_PATH):
        return
    with open(PENDING_PATH, encoding="utf-8") as f:
        events = [json.loads(l) for l in f if l.strip()]
    if not events:
        os.remove(PENDING_PATH)
        return
    try:
        post_json(cfg["ingest_url"], cfg["connect_key"], {"events": events[:200]})
        rest = events[200:]
        if rest:
            os.remove(PENDING_PATH)
            queue_pending(rest)
        else:
            os.remove(PENDING_PATH)
        log(f"rattrapage : {min(len(events), 200)} événement(s) en attente envoyés")
    except Exception:
        pass  # toujours hors-ligne, on réessaiera

def send_events(cfg, events, dry_run=False):
    if not events:
        return
    for e in events:
        log(f"  > {e['event'].upper():5s} {e.get('_name','')} "
            f"{e.get('alarm_type') or ''}{e.get('alarm_no') or ''} {e.get('alarm_msg') or ''}")
    payload = [{k: v for k, v in e.items() if not k.startswith("_")} for e in events]
    if dry_run:
        log("  (dry-run : rien envoyé)")
        return
    try:
        res = post_json(cfg["ingest_url"], cfg["connect_key"], {"events": payload})
        if res.get("error"):
            log(f"  !! refuse par le serveur : {res['error']}")
        else:
            log(f"  OK envoye (statuts mis a jour : {res.get('status_updated', 0)})")
    except Exception as ex:
        log(f"  !! hors-ligne ({ex}) — mis en file d'attente")
        queue_pending(payload)


# ------------------------------------------------------------
# Lecture FOCAS (mode réel)
# ------------------------------------------------------------
class ODBST(ctypes.Structure):
    _fields_ = [("hdck", c_short), ("tmmode", c_short), ("aut", c_short),
                ("run", c_short), ("motion", c_short), ("mstb", c_short),
                ("emergency", c_short), ("alarm", c_short), ("edit", c_short)]

class ODBALMMSG2(ctypes.Structure):
    _fields_ = [("alm_no", c_long), ("type", c_short), ("axis", c_short),
                ("msg_len", c_short), ("alm_msg", c_char * 64)]

_fwlib = None

def fwlib():
    global _fwlib
    if _fwlib is None:
        # Windows : fwlib64.dll (Python 64 bits) ou fwlib32.dll (32 bits).
        # Linux : libfwlib32.so. À placer à côté de ce script.
        names = ["fwlib64.dll", "fwlib32.dll"] if os.name == "nt" else ["libfwlib32.so"]
        err = None
        for name in names:
            try:
                _fwlib = ctypes.cdll.LoadLibrary(os.path.join(HERE, name))
                break
            except OSError as ex:
                err = ex
        if _fwlib is None:
            sys.exit(f"Bibliothèque FOCAS introuvable ({' / '.join(names)}) — la placer à côté du script. {err}")
        if hasattr(_fwlib, "cnc_startupprocess"):  # requis sur Linux
            _fwlib.cnc_startupprocess(0, b"focas.log")
    return _fwlib

def read_cnc(machine, timeout=3):
    """Interroge une CN. Retourne (etat, alarmes) :
    etat ∈ 'run' | 'stop' | 'alarm_raw' (alarme active, à filtrer ensuite)
    alarmes = [(no, type_txt, msg)]"""
    lib = fwlib()
    h = c_ushort(0)
    ip = machine["ip"].encode()
    ret = lib.cnc_allclibhndl3(ip, c_ushort(machine.get("port", 8193)), c_long(timeout), ctypes.byref(h))
    if ret != 0:
        return None, []  # injoignable
    try:
        st = ODBST()
        if lib.cnc_statinfo(h, ctypes.byref(st)) != 0:
            return None, []
        alarms = []
        if st.alarm:
            num = c_short(10)
            msgs = (ODBALMMSG2 * 10)()
            if lib.cnc_rdalmmsg2(h, c_short(-1), ctypes.byref(num), msgs) == 0:
                for i in range(num.value):
                    m = msgs[i]
                    alarms.append((int(m.alm_no),
                                   ALARM_TYPES.get(m.type, str(m.type)),
                                   m.alm_msg[:m.msg_len].decode("latin-1", "replace").strip()))
            return "alarm_raw", alarms
        # run : 0 reset, 1 stop, 2 hold, 3 start (en cycle)
        return ("run" if st.run == 3 else "stop"), []
    finally:
        lib.cnc_freelibhndl(h)


# ------------------------------------------------------------
# Simulation (mode sim) — pour tester la chaîne sans CN
# ------------------------------------------------------------
SIM_ALARMS = [
    (401, "SV", "SV0401 IMPROPER V_READY OFF"),
    (9001, "MC", "EM9001 SECURITE PORTE OUVERTE"),
    (704, "SP", "SP0704 SURCHARGE BROCHE"),
    (700, "OH", "OH0700 SURCHAUFFE ARMOIRE"),
]
_sim_state = {}

def read_sim(machine):
    s = _sim_state.setdefault(machine["ip"], {"etat": "run", "alarm": None})
    r = random.random()
    if s["etat"] == "alarm_raw":
        if r < 0.25:  # la panne se répare
            s["etat"], s["alarm"] = "run", None
    elif r < 0.06:  # panne !
        s["etat"], s["alarm"] = "alarm_raw", random.choice(SIM_ALARMS)
    elif r < 0.30:  # changement cycle/arrêt
        s["etat"] = "stop" if s["etat"] == "run" else "run"
    alarms = [s["alarm"]] if s["alarm"] else []
    return s["etat"], alarms


# ------------------------------------------------------------
# Boucle principale
# ------------------------------------------------------------
def main():
    dry_run = "--dry-run" in sys.argv
    cfg = load_config()

    if "--machines" in sys.argv:
        res = post_json(cfg["ingest_url"], cfg["connect_key"], {"action": "machines"})
        if res.get("error"):
            sys.exit(f"Erreur : {res['error']}")
        print(f"\nMachines de « {res['org']} » (copier les id dans config.json) :\n")
        for m in res["machines"]:
            print(f"  {m['id']}  {m['name']}  ({m.get('code') or 'sans code'})  [{m['status']}]")
        return

    reader = read_sim if cfg["mode"] == "sim" else read_cnc
    source = "sim" if cfg["mode"] == "sim" else "gateway"
    log(f"MaintX Gateway — mode {cfg['mode']}, {len(cfg['machines'])} machine(s), "
        f"scrutation {cfg['poll_seconds']} s{' [DRY-RUN]' if dry_run else ''}")

    last_sent = {}   # machine_id -> dernier event envoyé
    alarm_since = {} # machine_id -> timestamp 1re détection d'alarme "panne"

    while True:
        events = []
        for m in cfg["machines"]:
            etat, alarms = reader(m)
            mid = m["machine_id"]
            if etat is None:
                continue  # CN injoignable : on ne conclut rien

            # Filtrage panne : seules certaines catégories d'alarme,
            # et seulement si elles persistent (alarm_min_seconds)
            if etat == "alarm_raw":
                panne = [a for a in alarms if a[1] in cfg["alarm_types_panne"]]
                if panne:
                    alarm_since.setdefault(mid, time.time())
                    if time.time() - alarm_since[mid] >= cfg["alarm_min_seconds"]:
                        etat = "alarm"
                    else:
                        continue  # on attend confirmation
                else:
                    etat = "stop"  # alarme "bénigne" (ex: PS) = machine arrêtée
                    alarm_since.pop(mid, None)
            else:
                alarm_since.pop(mid, None)

            if last_sent.get(mid) == etat:
                continue  # pas de changement → rien à envoyer
            last_sent[mid] = etat

            ev = {"machine_id": mid, "event": etat, "at": now_iso(),
                  "source": source, "_name": m.get("name", m["ip"])}
            if etat == "alarm":
                no, typ, msg = (panne[0] if panne else (None, None, None))
                ev.update({"alarm_no": no, "alarm_type": typ, "alarm_msg": msg})
            events.append(ev)

        send_events(cfg, events, dry_run)
        if not dry_run:
            flush_pending(cfg)
        time.sleep(cfg["poll_seconds"])


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nArrêt.")
