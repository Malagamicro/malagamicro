import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Default fallback chain
const DEFAULT_MODEL_CHAIN = [
  "anthropic/claude-3.5-sonnet",
  "google/gemini-2.0-flash",
  "openai/gpt-4o-mini",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, stream = true, preferredModels, tools, tool_choice } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const models = Array.isArray(preferredModels) && preferredModels.length
      ? preferredModels
      : DEFAULT_MODEL_CHAIN;

    let lastError: string | null = null;

    for (const model of models) {
      try {
        console.log(`[ai-completion] Trying model: ${model}`);

        const body: Record<string, unknown> = { model, messages, stream };
        if (tools) body.tools = tools;
        if (tool_choice) body.tool_choice = tool_choice;

        const response = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://malagamicro.lovable.app",
            "X-Title": "MalagaMicro CRM",
          },
          body: JSON.stringify(body),
        });

        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit excedido en OpenRouter. Intenta de nuevo en unos segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos agotados en OpenRouter. Añade fondos en tu cuenta." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!response.ok) {
          const errText = await response.text();
          lastError = `${model} → ${response.status}: ${errText}`;
          console.warn(`[ai-completion] Model ${model} failed: ${lastError}`);
          continue;
        }

        console.log(`[ai-completion] Success with model: ${model}`);

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
