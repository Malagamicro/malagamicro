import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Ordered fallback chain – gateway-available models only
const MODEL_CHAIN = [
  "openai/gpt-5.2",
  "google/gemini-2.5-pro",
  "openai/gpt-5",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, stream = true, preferredModels } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const models = Array.isArray(preferredModels) && preferredModels.length
      ? preferredModels
      : MODEL_CHAIN;

    let lastError: string | null = null;
    let usedModel: string | null = null;

    for (const model of models) {
      try {
        console.log(`[ai-completion] Trying model: ${model}`);
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model, messages, stream }),
        });

        // Rate-limit / payment errors → bubble up immediately
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Intenta de nuevo en unos segundos." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos agotados. Añade fondos en Lovable → Settings → Workspace → Usage." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!response.ok) {
          const errText = await response.text();
          lastError = `${model} → ${response.status}: ${errText}`;
          console.warn(`[ai-completion] Model ${model} failed: ${lastError}`);
          continue; // try next model
        }

        usedModel = model;

        if (stream) {
          return new Response(response.body, {
            headers: {
              ...corsHeaders,
              "Content-Type": "text/event-stream",
              "X-Model-Used": model,
            },
          });
        }

        const data = await response.json();
        return new Response(JSON.stringify({ ...data, _model_used: model }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (modelErr) {
        lastError = `${model} → ${modelErr instanceof Error ? modelErr.message : String(modelErr)}`;
        console.warn(`[ai-completion] Model ${model} threw:`, lastError);
        continue;
      }
    }

    // All models failed
    console.error("[ai-completion] All models exhausted. Last error:", lastError);
    return new Response(
      JSON.stringify({ error: `Todos los modelos fallaron. Último error: ${lastError}` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[ai-completion] Fatal:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
