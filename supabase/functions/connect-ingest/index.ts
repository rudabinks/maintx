// ============================================================
// MaintX — Edge Function "connect-ingest" (plan Connect)
// Reçoit les événements machines (run/stop/alarm) envoyés par la
// passerelle FOCAS installée dans l'atelier, les enregistre dans
// machine_events et met à jour le statut andon des machines.
//
// Authentification : header "x-connect-key" = organizations.connect_key
// (patch-v15.sql). PAS de JWT : décocher "Verify JWT" au déploiement.
//
// Deux usages :
//  POST { action: "machines" }
//    → liste {id, name, code, status} des machines de l'org
//      (pour remplir le config.json de la passerelle)
//  POST { events: [{machine_id, event, alarm_no?, alarm_msg?, alarm_type?, at?, source?}] }
//    → insère les événements (max 200) + met à jour machines.status :
//      alarm → 'alarm' · run → 'running' · stop → 'stopped'
//      (une machine en 'maintenance' n'est jamais écrasée)
//
// Déploiement : Edge Functions → Deploy new function → "connect-ingest"
// ⚠️ Noter le SLUG obtenu (aléatoire) : il va dans gateway/config.json,
// pas dans FN (le frontend n'appelle pas cette fonction).
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-connect-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const EVENTS = new Set(["run", "stop", "alarm"]);
const STATUS_FROM_EVENT: Record<string, string> = { run: "running", stop: "stopped", alarm: "alarm" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const key = req.headers.get("x-connect-key");
    if (!key) return json({ error: "x-connect-key manquant" }, 401);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: org } = await svc.from("organizations").select("id, name").eq("connect_key", key).maybeSingle();
    if (!org) return json({ error: "connect_key invalide" }, 401);

    const body = await req.json().catch(() => ({}));

    // --- Liste des machines (aide à la configuration de la passerelle)
    if (body.action === "machines") {
      const { data: machines, error } = await svc
        .from("machines").select("id, name, code, status").eq("org_id", org.id).order("name");
      if (error) return json({ error: error.message }, 500);
      return json({ org: org.name, machines });
    }

    // --- Ingestion d'événements
    const events = Array.isArray(body.events) ? body.events.slice(0, 200) : [];
    if (!events.length) return json({ error: "events vide" }, 400);

    // Machines valides de CETTE org uniquement (une clé ne peut pas écrire ailleurs)
    const { data: machines } = await svc.from("machines").select("id, status").eq("org_id", org.id);
    const byId = new Map((machines ?? []).map((m) => [m.id, m]));

    const rows = [];
    for (const e of events) {
      if (!byId.has(e.machine_id) || !EVENTS.has(e.event)) continue;
      rows.push({
        org_id: org.id,
        machine_id: e.machine_id,
        event: e.event,
        at: e.at || new Date().toISOString(),
        alarm_no: e.alarm_no ?? null,
        alarm_msg: (e.alarm_msg || "").slice(0, 500) || null,
        alarm_type: (e.alarm_type || "").slice(0, 10) || null,
        source: (e.source || "gateway").slice(0, 20),
      });
    }
    if (!rows.length) return json({ error: "aucun événement valide (machine_id inconnu ?)" }, 400);

    const { error: eIns } = await svc.from("machine_events").insert(rows);
    if (eIns) return json({ error: eIns.message }, 500);

    // Statut andon : dernier événement par machine → machines.status
    // (jamais toucher une machine passée manuellement en 'maintenance')
    const last = new Map<string, string>();
    for (const r of rows) last.set(r.machine_id, r.event); // rows dans l'ordre reçu
    let updated = 0;
    for (const [machine_id, event] of last) {
      const m = byId.get(machine_id);
      if (!m || m.status === "maintenance") continue;
      const status = STATUS_FROM_EVENT[event];
      if (status === m.status) continue;
      const { error: eUp } = await svc.from("machines").update({ status }).eq("id", machine_id);
      if (!eUp) updated++;
    }

    return json({ inserted: rows.length, status_updated: updated });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
