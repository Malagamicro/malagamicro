import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Eres un experto diseñador de plantillas de email HTML profesionales. Tu trabajo es ayudar al usuario a crear y editar plantillas de email atractivas y responsivas.

REGLAS IMPORTANTES:
- Siempre responde en español
- Cuando el usuario pida crear o editar una plantilla, genera el HTML completo modificado
- SIEMPRE devuelve el HTML COMPLETO de la plantilla, no solo los cambios parciales
- El HTML debe ser responsive y compatible con clientes de email (usa tablas para layout, inline CSS)
- Usa un diseño profesional con colores atractivos
- Incluye variables como {{nombre}}, {{empresa}}, {{ciudad}}, {{email}} donde sea apropiado
- El ancho máximo del email debe ser 600px
- Usa fuentes seguras: Arial, Helvetica, sans-serif
- Cuando generes HTML, envuélvelo entre las etiquetas \`\`\`html y \`\`\` para que sea fácil de extraer
- Si el usuario pide cambios sobre una plantilla existente, modifica ESA plantilla y devuelve el HTML completo actualizado
- Puedes sugerir mejoras de diseño, copy, estructura
- Si no se pide un email específico, ayuda con ideas y sugerencias
- Sé conciso en tus explicaciones, lo importante es el HTML resultante
- El usuario ve los cambios en tiempo real en una vista previa al lado del chat`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de peticiones excedido, inténtalo de nuevo en unos segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados. Añade fondos a tu workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-email-template error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
