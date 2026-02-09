import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const systemPrompt = `Eres Micro, el asistente virtual de MalagaMicro CRM. Eres un pequeño robot amigable y servicial que ayuda a los usuarios con preguntas generales sobre el sistema, productividad y ventas.

Personalidad:
- Eres amable, entusiasta y servicial
- Hablas en español con un tono cercano pero profesional
- Das respuestas concisas y útiles
- Te gusta hacer referencias a que eres un robot y a la tecnología

Puedes ayudar con:
- Consejos de productividad y gestión de tiempo
- Tips de ventas y CRM
- Responder preguntas generales
- Motivar al usuario

No tienes acceso a los datos del CRM, así que si preguntan por leads o datos específicos, sugiere que usen el Chat IA principal que sí tiene acceso a herramientas del sistema.`;

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        // Recomendado por OpenRouter
        "HTTP-Referer": "https://malagamicro.lovable.app",
        "X-Title": "MalagaMicro CRM Mascot Chat",
      },
      body: JSON.stringify({
        model: "liquid/lfm2-8b-a1b",
        messages: [{ role: "system", content: systemPrompt }, ...(messages ?? [])],
        stream: true,
      }),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      console.error("OpenRouter API error:", upstream.status, errorText);

      let friendly = "Error al conectar con el asistente";
      try {
        const parsed = JSON.parse(errorText);
        const msg = parsed?.error?.message ?? parsed?.error ?? parsed?.message;
        if (typeof msg === "string" && msg.trim()) friendly = msg;
      } catch {
        // ignore
      }

      const status = upstream.status === 429 ? 429 : upstream.status === 402 ? 402 : 502;
      return new Response(JSON.stringify({ error: friendly }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Mascot chat error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Error desconocido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
