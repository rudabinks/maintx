// ============================================================
// MaintX — Edge Function "mecano-ask"
// Répond à une question technique UNIQUEMENT à partir des extraits
// de documentation indexés de la machine, source citée.
// Déploiement : Edge Functions → Deploy new function → "mecano-ask"
// Secret requis : ANTHROPIC_API_KEY (déjà en place).
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { machine_id, machine_name, question } = await req.json();
    if (!machine_id || !question) return json({ error: "machine_id et question requis" }, 400);

    // Client utilisateur : la RLS garantit l'isolation par org
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    // Recherche plein-texte française ; repli sur mode simple si zéro résultat
    let { data: hits } = await sb.from("doc_chunks")
      .select("doc_name,page,content").eq("machine_id", machine_id)
      .textSearch("tsv", question, { type: "websearch", config: "french" }).limit(6);
    if (!hits?.length) {
      const r2 = await sb.from("doc_chunks")
        .select("doc_name,page,content").eq("machine_id", machine_id)
        .textSearch("tsv", question, { type: "plain", config: "french" }).limit(6);
      hits = r2.data;
    }
    if (!hits?.length) {
      return json({ answer: "Je ne trouve pas ça dans la doc de cette machine. (Vérifiez que les documents sont bien indexés — bouton 🧠 dans l'onglet Documents.)", sources: [] });
    }

    const extracts = hits.map((h, k) => `[${k+1}] ${h.doc_name} — page ${h.page}\n${h.content}`).join("\n\n");
    const prompt = `Tu es "Mécano", assistant technique d'atelier. Question sur la machine "${machine_name || ""}" :
"${question}"

Extraits de la documentation de CETTE machine (ta seule source autorisée) :

${extracts}

RÈGLES STRICTES : réponds en français, 50 mots maximum, style direct d'atelier.
UNIQUEMENT à partir des extraits — ne devine JAMAIS, ne complète JAMAIS avec des
connaissances générales. Termine par la source entre parenthèses : (nom du doc, p. X).
Si les extraits ne répondent pas à la question, réponds exactement :
"Je ne trouve pas ça dans la doc de cette machine."`;

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
    if (!r.ok) return json({ error: "Erreur API IA", detail: await r.text() }, 502);
    const data = await r.json();
    const answer = (data.content?.[0]?.text ?? "").trim();
    const sources = [...new Map(hits.map(h => [`${h.doc_name}|${h.page}`, { doc: h.doc_name, page: h.page }])).values()];
    return json({ answer, sources });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
