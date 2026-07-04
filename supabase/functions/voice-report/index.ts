// ============================================================
// MaintX — Edge Function "voice-report" (mode mains sales)
// Reçoit la transcription dictée par le technicien, la structure
// avec Claude Haiku et renvoie un compte rendu exploitable.
//
// Déploiement : Supabase Dashboard → Edge Functions → Deploy new
// function → nom "voice-report" → coller ce code.
// Secret requis : ANTHROPIC_API_KEY (Edge Functions → Secrets)
// ============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { transcript, title, machine } = await req.json();
    if (!transcript || transcript.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Transcription vide" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const prompt = `Tu es l'assistant d'une GMAO française pour ateliers industriels.
Un technicien vient de dicter son compte rendu à la voix (transcription brute, parfois
hachée, avec du vocabulaire d'atelier). Intervention : "${title || "sans titre"}"${machine ? ` sur la machine "${machine}"` : ""}.

Transcription :
"""
${transcript}
"""

RÈGLE DE STYLE STRICTE : compte rendu d'atelier télégraphique. Les techniciens n'ont
pas le temps de lire. Uniquement les faits : quoi constaté, quoi fait. Pas d'intro,
pas de politesse, pas de reformulation du contexte, pas de "il est recommandé de".
Exemple de bon resume : "Roulement moteur remplacé (encrassé). Machine relancée, RAS."

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises de code :
{
  "resume": "1 à 2 phrases très courtes, 20 mots maximum au total",
  "cause": "mecanique" | "electrique" | "pneumatique" | "hydraulique" | "cn_automatisme" | "autre" | null,
  "repare": true si la machine est réparée et opérationnelle, false sinon,
  "pieces": ["références/pièces mentionnées, telles quelles"],
  "actions_restantes": "très court (10 mots max), ou null"
}`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 350,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return new Response(JSON.stringify({ error: "Erreur API IA", detail }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const data = await r.json();
    let text = (data.content?.[0]?.text ?? "").trim();
    // Retire d'éventuelles balises ```json ... ```
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(text);

    return new Response(JSON.stringify(parsed),
      { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
