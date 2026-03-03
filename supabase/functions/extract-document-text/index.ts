import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const { file_base64, file_type, file_name } = await req.json();
    if (!file_base64) throw new Error("file_base64 is required");

    const mimeType = file_type || "application/octet-stream";
    const isPdf = mimeType === "application/pdf" || file_name?.endsWith(".pdf");
    const isImage = mimeType.startsWith("image/");

    // Use Gemini for document understanding - it natively supports PDFs and images
    const messages: any[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extrae TODO el texto y contenido de este documento de forma completa y estructurada. 
Incluye:
- Todo el texto visible
- Tablas (formateadas en markdown)
- Listas y enumeraciones
- Encabezados y secciones
- Cualquier dato numérico, fechas, nombres, direcciones

NO resumas. Extrae el contenido COMPLETO tal como aparece.
Responde SOLO con el contenido extraído, sin comentarios adicionales.
Si el documento tiene varias páginas, extrae todas.
Nombre del archivo: ${file_name || "documento"}`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${isPdf ? "application/pdf" : isImage ? mimeType : "application/pdf"};base64,${file_base64}`,
            },
          },
        ],
      },
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 32000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter error:", errText);
      throw new Error(`AI extraction failed: ${response.status}`);
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ 
        text: extractedText, 
        char_count: extractedText.length,
        file_name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Extract error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
