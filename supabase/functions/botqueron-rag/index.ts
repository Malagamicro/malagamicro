import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, category, limit = 5 } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Se requiere un campo 'query'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Text-based search using keywords
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length > 2)
      .slice(0, 10);

    if (keywords.length === 0) {
      return new Response(JSON.stringify({ results: [], context: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build ilike conditions for keyword matching
    let queryBuilder = supabase
      .from("botqueron_knowledge")
      .select("id, title, content, category, tags, created_at");

    if (category) {
      queryBuilder = queryBuilder.eq("category", category);
    }

    const { data: allDocs, error } = await queryBuilder.order("created_at", { ascending: false });

    if (error) throw error;

    // Score each document by keyword relevance
    const scored = (allDocs || []).map((doc: any) => {
      const text = `${doc.title} ${doc.content} ${(doc.tags || []).join(" ")}`.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        const matches = text.split(kw).length - 1;
        score += matches;
      }
      return { ...doc, _score: score };
    });

    // Filter and sort by relevance
    const results = scored
      .filter((d: any) => d._score > 0)
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, ...doc }: any) => doc);

    // Build context string for AI consumption
    const context = results
      .map((r: any, i: number) => `[${i + 1}] ${r.title}\n${r.content}`)
      .join("\n\n---\n\n");

    return new Response(
      JSON.stringify({ results, context, total_found: results.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[botqueron-rag] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
