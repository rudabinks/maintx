// ============================================================
// MaintX — Edge Function "doc-ingest"
// Extrait le texte d'un PDF uploadé et l'indexe page par page
// dans doc_chunks pour l'assistant Mécano.
// Déploiement : Edge Functions → Deploy new function → "doc-ingest"
// Aucun secret à ajouter (utilise les clés Supabase intégrées).
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { document_id } = await req.json();
    if (!document_id) return json({ error: "document_id manquant" }, 400);

    // Client "utilisateur" : vérifie que l'appelant a le droit de voir ce document (RLS)
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: doc, error: e1 } = await userClient
      .from("machine_documents").select("*").eq("id", document_id).single();
    if (e1 || !doc) return json({ error: "Document introuvable ou accès refusé" }, 403);

    // Client service : télécharge le fichier et écrit les chunks
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: file, error: e2 } = await svc.storage.from("docs").download(doc.storage_path);
    if (e2 || !file) return json({ error: "Téléchargement du PDF impossible" }, 500);

    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: false });
    const pages: string[] = Array.isArray(text) ? text : [String(text)];

    // Découpe : une page = un chunk ; pages longues coupées en morceaux ~1100 caractères
    const chunks: { page: number; content: string }[] = [];
    pages.forEach((p, idx) => {
      const clean = (p || "").replace(/\s+/g, " ").trim();
      if (clean.length < 30) return; // page vide ou scannée sans texte
      for (let k = 0; k < clean.length; k += 1100) {
        chunks.push({ page: idx + 1, content: clean.slice(k, k + 1250) });
      }
    });

    await svc.from("doc_chunks").delete().eq("document_id", document_id);
    if (chunks.length > 0) {
      const rows = chunks.map(c => ({
        org_id: doc.org_id, machine_id: doc.machine_id, document_id: doc.id,
        doc_name: doc.name, page: c.page, content: c.content,
      }));
      // Insertion par lots de 200
      for (let k = 0; k < rows.length; k += 200) {
        const { error: e3 } = await svc.from("doc_chunks").insert(rows.slice(k, k + 200));
        if (e3) return json({ error: "Insertion des extraits : " + e3.message }, 500);
      }
    }
    await svc.from("machine_documents").update({ indexed_at: new Date().toISOString() }).eq("id", document_id);

    return json({ pages: pages.length, chunks: chunks.length,
      note: chunks.length === 0 ? "Aucun texte lisible (PDF scanné ?)" : undefined });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
