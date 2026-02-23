import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, currentTheme } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Eres un diseñador de temas UI experto. El usuario te describe cómo quiere que se vea su aplicación CRM y tú generas un tema completo.

Debes responder SOLO con un JSON válido con esta estructura exacta (valores HSL sin "hsl()" wrapper, solo "H S% L%"):

{
  "colorPreset": "custom",
  "customColors": {
    "primary": "220 70% 50%",
    "primaryForeground": "0 0% 100%",
    "secondary": "210 40% 45%",
    "secondaryForeground": "0 0% 100%",
    "accent": "25 95% 53%",
    "accentForeground": "0 0% 100%",
    "background": "222 47% 11%",
    "foreground": "0 0% 98%",
    "card": "222 47% 14%",
    "cardForeground": "0 0% 98%",
    "muted": "222 47% 18%",
    "mutedForeground": "220 14% 65%",
    "border": "222 47% 20%",
    "sidebarBackground": "222 47% 8%",
    "sidebarForeground": "0 0% 98%",
    "sidebarAccent": "222 47% 14%",
    "sidebarBorder": "222 47% 18%"
  },
  "backgroundPattern": "none",
  "fontFamily": "dm-sans",
  "borderRadius": "lg",
  "sidebarStyle": "solid",
  "animationSpeed": "normal"
}

Reglas:
- Genera colores coherentes y con buen contraste
- Siempre genera tanto variantes claras como oscuras (usa la variante oscura por defecto)
- backgroundPattern opciones: none, dots, grid, diagonal, waves, gradient-radial
- fontFamily opciones: dm-sans, inter, poppins, nunito, outfit, work-sans, space-grotesk, raleway, plus-jakarta, manrope
- borderRadius opciones: none, sm, md, lg, xl, full
- sidebarStyle opciones: solid, glass, transparent
- animationSpeed opciones: none, reduced, normal, smooth
- NO incluyas texto explicativo, SOLO el JSON`;

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
          { role: "user", content: `Tema actual: ${JSON.stringify(currentTheme || {})}. Petición del usuario: ${prompt}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Inténtalo de nuevo en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "No se pudo generar el tema" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const themeData = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ theme: themeData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-theme error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
