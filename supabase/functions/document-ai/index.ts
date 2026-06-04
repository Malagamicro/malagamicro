import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, action, fileType } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const basePrompts: Record<string, Record<string, string>> = {
      markdown: {
        write: `Eres un asistente experto en redacción de documentos profesionales en Markdown.
Genera documentos bien estructurados usando encabezados (#, ##, ###), listas, negritas, cursivas, tablas, bloques de código y otros elementos Markdown.
Responde siempre en español salvo que se indique lo contrario.
Genera contenido completo y profesional.`,
        edit: `Eres un editor profesional de documentos Markdown. El usuario te proporcionará un documento Markdown existente y te pedirá modificaciones.
Devuelve el documento completo modificado manteniendo formato Markdown válido.
Preserva la estructura existente salvo que se indique lo contrario. No añadas explicaciones, solo el documento editado.`,
        improve: `Eres un editor profesional de Markdown. Mejora el documento: corrige gramática, mejora redacción, 
añade estructura si falta, mejora el uso de elementos Markdown (encabezados, listas, tablas) y hazlo más profesional.
Devuelve el documento completo mejorado. No añadas explicaciones, solo el documento.`,
        summarize: `Eres un asistente de resumen. Resume el documento Markdown proporcionado de forma clara y concisa.
Mantén los puntos clave y genera un resumen en formato Markdown bien estructurado.`,
      },
      spreadsheet: {
        write: `Eres un asistente experto en hojas de cálculo. Cuando el usuario te pida crear datos, genera una tabla en formato CSV (valores separados por tabuladores).
Cada fila en una línea separada. Las celdas pueden contener:
- Valores numéricos: 100, 3.14
- Texto: Producto A, Ventas
- Fórmulas de Excel: =SUM(A1:A10), =AVERAGE(B2:B5), =VLOOKUP(A1,C1:D10,2), =IF(A1>10,"Alto","Bajo"), =COUNTIF(A1:A10,">5"), =SUMIF(A1:A10,">5",B1:B10)
- Aritmética entre celdas: =A1+B1, =C3*D3, =A1/B1+C1

Genera datos realistas y usa fórmulas cuando sea apropiado. Responde SOLO con los datos tabulados, sin explicaciones.`,
        edit: `Eres un experto en hojas de cálculo. El usuario te proporcionará datos tabulados (formato TSV) y te pedirá modificaciones.
Devuelve los datos completos modificados en formato TSV (tabulador como separador).
Puedes usar fórmulas de Excel como =SUM, =AVERAGE, =IF, =VLOOKUP, =COUNTIF, =SUMIF, aritmética (=A1+B1).
No añadas explicaciones, solo los datos tabulados.`,
        improve: `Eres un experto en hojas de cálculo. Mejora los datos proporcionados:
- Añade fórmulas de totales, promedios, porcentajes donde sea útil
- Mejora la organización y estructura
- Añade encabezados si faltan
- Usa fórmulas de Excel: =SUM, =AVERAGE, =IF, =VLOOKUP, =COUNTIF, =SUMIF
Devuelve los datos completos en formato TSV. No añadas explicaciones.`,
        summarize: `Eres un analista de datos. Analiza los datos de la hoja de cálculo proporcionada y genera un resumen con:
- Estadísticas clave (totales, promedios, máximos, mínimos)
- Tendencias observadas
- Insights relevantes
Responde en formato Markdown con tablas si es necesario.`,
      },
      text: {
        write: `Eres un asistente de redacción de texto plano. Genera contenido claro y bien organizado sin formato especial.
Usa saltos de línea para separar párrafos. Responde en español salvo que se indique lo contrario.`,
        edit: `Eres un editor de texto plano. El usuario te dará un texto y te pedirá modificaciones.
Devuelve el texto completo modificado sin formato especial (sin Markdown). No añadas explicaciones.`,
        improve: `Eres un editor profesional. Mejora el texto proporcionado: corrige gramática, mejora redacción y claridad.
Devuelve el texto completo mejorado sin formato Markdown. No añadas explicaciones.`,
        summarize: `Resume el texto proporcionado de forma clara y concisa. Mantén los puntos clave. Responde en texto plano.`,
      },
    };

    const type = fileType || 'markdown';
    const act = action || 'write';
    const systemContent = basePrompts[type]?.[act] || basePrompts.markdown.write;

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://malagamicro.lovable.app",
        "X-Title": "MalagaMicro CRM",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Inténtalo de nuevo en unos momentos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Se requiere crédito adicional para usar la IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("document-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
