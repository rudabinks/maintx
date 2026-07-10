// ============================================================
// MaintX — Edge Function "plan-directive"
// Rédige des directives claires pour le technicien à partir des
// infos du responsable maintenance (machine, tâche, notes).
// Déploiement : Edge Functions → Deploy new function → "plan-directive"
// Secret requis : ANTHROPIC_API_KEY (déjà en place).
// ============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { machine, title, type, notes } = await req.json();

    const prompt = `Tu rédiges des directives d'intervention pour un technicien de maintenance
industrielle. Le responsable maintenance a préparé :
- Machine : ${machine || "—"}
- Intervention : ${title || "—"}
- Type : ${type || "—"}
- Notes du responsable : ${notes || "aucune"}

Rédige des directives claires et actionnables pour le technicien, en français.
RÈGLES : 60 mots maximum. Style d'atelier, direct. Liste les points à faire dans
l'ordre. Ajoute UN rappel sécurité si pertinent (consignation, EPI). Pas d'intro,
pas de politesse. Texte brut, tu peux utiliser des tirets pour les étapes.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
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
