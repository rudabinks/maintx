// ============================================================
// MaintX — Edge Function "weekly-brief" (brief du lundi)
// Reçoit les stats de la semaine, renvoie un brief ultra concis.
// Déploiement : Edge Functions → Deploy new function → "weekly-brief"
// Secret requis : ANTHROPIC_API_KEY (déjà en place pour voice-report)
// ============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { stats, org } = await req.json();

    const prompt = `Tu rédiges le brief hebdomadaire du responsable maintenance d'un
atelier industriel français (${org || "PME"}). Voici les chiffres de la semaine :
${JSON.stringify(stats, null, 1)}

RÈGLES : 45 mots MAXIMUM. Style télégraphique d'atelier, factuel, direct.
Commence par l'essentiel. Signale les récurrences (même machine ou même cause
plusieurs fois = "à creuser"). Termine par la priorité de la semaine qui commence.
Pas de politesse, pas d'emoji, pas de titre. Texte brut uniquement.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      return new Response(JSON.stringify({ error: "Erreur API IA", detail: await r.text() }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const data = await r.json();
    const text = (data.content?.[0]?.text ?? "").trim();
    return new Response(JSON.stringify({ text }),
      { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
