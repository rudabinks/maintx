// ============================================================
// MaintX — Edge Function "send-plan"
// Envoie au technicien un email (via Resend) avec les directives
// de l'intervention planifiée + une pièce jointe calendrier (.ics)
// qu'il ajoute à son agenda (Google, Outlook, Apple…) en un clic.
//
// Déploiement : Edge Functions → Deploy new function → "send-plan"
// Secret requis : RESEND_API_KEY (clé du compte Resend).
// (SUPABASE_URL / SERVICE_ROLE_KEY sont fournis automatiquement.)
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const FROM = "MaintX <planning@maintx.fr>"; // ⚠️ le domaine maintx.fr doit être vérifié dans Resend

function icsEscape(s: string) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { assigned_to, machine, title, date, directive, org_name } = await req.json();
    if (!assigned_to) return json({ error: "Aucun technicien assigné" }, 400);

    // Récupère l'email du technicien via le rôle service (auth.users)
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u, error: eu } = await svc.auth.admin.getUserById(assigned_to);
    const to = u?.user?.email;
    if (eu || !to) return json({ error: "Email du technicien introuvable" }, 404);

    // Construit l'événement calendrier (journée entière à la date prévue)
    const d = (date || "").replace(/-/g, "");
    const dStart = d;
    const dEnd = d ? (Number(d) + 1).toString() : d; // lendemain (all-day exclusif)
    const summary = `MaintX — ${title || "Intervention"}${machine ? " · " + machine : ""}`;
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MaintX//FR", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${crypto.randomUUID()}@maintx.fr`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTSTART;VALUE=DATE:${dStart}`,
      `DTEND;VALUE=DATE:${dEnd}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(directive || "")}`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const icsB64 = btoa(unescape(encodeURIComponent(ics)));

    const html = `<div style="font-family:system-ui,sans-serif;color:#1B1D21">
      <div style="border-bottom:4px solid #FFC400;padding-bottom:8px;font-weight:800;font-size:18px">MaintX${org_name ? " · " + org_name : ""}</div>
      <p style="font-size:15px">Une intervention vous a été assignée :</p>
      <table style="font-size:14px;border-collapse:collapse">
        <tr><td style="padding:3px 12px 3px 0;color:#6B7079">Intervention</td><td style="font-weight:700">${title || "—"}</td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#6B7079">Machine</td><td>${machine || "—"}</td></tr>
        <tr><td style="padding:3px 12px 3px 0;color:#6B7079">Date prévue</td><td>${date || "—"}</td></tr>
      </table>
      ${directive ? `<div style="background:#FFF7DB;border-left:4px solid #FFC400;padding:10px 12px;margin-top:12px;white-space:pre-wrap;font-size:14px"><b>Directives :</b><br>${directive}</div>` : ""}
      <p style="font-size:12px;color:#8A8F98;margin-top:14px">Ajoutez cette intervention à votre agenda avec la pièce jointe. — MaintX</p>
    </div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + (Deno.env.get("RESEND_API_KEY") ?? ""), "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to, subject: summary, html,
        reply_to: "contact@maintx.fr", // les réponses des techniciens arrivent sur la boîte contact
        attachments: [{ filename: "intervention.ics", content: icsB64 }],
      }),
    });
    if (!r.ok) return json({ error: "Envoi email refusé", detail: await r.text() }, 502);
    return json({ sent: true, to });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
