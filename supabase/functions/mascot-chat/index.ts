import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
- Usas emojis ocasionalmente para ser más expresivo 🤖
- Te gusta hacer referencias a que eres un robot y a la tecnología

Puedes ayudar con:
- Consejos de productividad y gestión de tiempo
- Tips de ventas y CRM
- Responder preguntas generales
- Motivar al usuario

No tienes acceso a los datos del CRM, así que si preguntan por leads o datos específicos, sugiere que usen el Chat IA principal que sí tiene acceso a herramientas del sistema.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://malagamicro.lovable.app",
        "X-Title": "MalagaMicro CRM Mascot Chat",
      },
      body: JSON.stringify({
        model: "google/gemma-3-27b-it:free",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Intenta de nuevo en unos momentos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Error al conectar con el asistente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Mascot chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
