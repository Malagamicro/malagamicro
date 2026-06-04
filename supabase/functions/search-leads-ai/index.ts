import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LeadResult {
  name: string;
  address: string;
  phone?: string;
  phoneType?: "mobile" | "landline" | "unknown";
  email?: string;
  website?: string;
  category: string;
  notes?: string;
}

function classifySpanishPhone(phone: string): "mobile" | "landline" | "unknown" {
  const clean = phone.replace(/\D/g, "");
  // Eliminar el prefijo internacional de España si existe
  const national = clean.startsWith("34") && clean.length > 9 ? clean.substring(2) : clean;
  if (national.length === 9) {
    const first = national[0];
    if (first === "6" || first === "7") return "mobile";
    if (first === "8" || first === "9") return "landline";
  }
  return "unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No se proporcionó token de autorización" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Verificar sesión del usuario
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query, location, filters } = await req.json();
    if (!query || !location) {
      throw new Error("El tipo de negocio (query) y la ubicación son obligatorios.");
    }

    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) {
      throw new Error("La clave OPENROUTER_API_KEY no está configurada.");
    }

    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    console.log(`[AI-LEADS] Iniciando búsqueda con Claude Sonnet 4.6 para: "${query}" en "${location}"`);

    const systemPrompt = `Eres un experto investigador y extractor de leads comerciales.
Tu tarea es buscar información en internet sobre empresas, comercios y tiendas que coincidan con la descripción y ubicación dadas.
Debes realizar búsquedas web exhaustivas para encontrar la información más precisa posible, incluyendo emails, páginas web y números de teléfono.
Debes buscar y extraer entre 5 y 15 leads de alta calidad.

Para cada empresa o comercio que encuentres, extrae:
- Nombre de la empresa.
- Dirección física completa (calle, número, código postal si está disponible).
- Teléfono de contacto.
- Tipo de teléfono:
  - "mobile" si es un teléfono móvil español (empieza por 6 o 7) y es apto para WhatsApp.
  - "landline" si es un teléfono fijo español (empieza por 8 o 9).
  - "unknown" en otros casos.
- Email de contacto (búscalo activamente en su web o directorios).
- Sitio web (sin https:// o http://).
- Categoría o sector de la empresa.
- Notas breves explicando qué ofrece o algún detalle relevante extraído de la búsqueda.

Debes responder ÚNICAMENTE con un JSON que sea un array de objetos con la siguiente estructura exacta:
[
  {
    "name": "Nombre de la empresa",
    "address": "Dirección completa",
    "phone": "Teléfono",
    "phoneType": "mobile" | "landline" | "unknown",
    "email": "correo@empresa.com",
    "website": "empresa.com",
    "category": "Restaurante",
    "notes": "Especialidad en comida vegetariana y menús diarios."
  }
]

No incluyas explicaciones previas, posteriores ni marcas de formato markdown fuera del propio bloque de código JSON. Responde únicamente con el JSON válido.`;

    const userMessage = `Busca empresas del tipo "${query}" en la ubicación "${location}". Filtros e instrucciones adicionales: "${filters || 'Ninguno'}"`;

    // Llamar a Claude Sonnet 4.6 en OpenRouter con web search
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.6",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        tools: [
          { type: "openrouter:web_search" }
        ],
        temperature: 0.2,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`OpenRouter API falló con código ${aiRes.status}: ${errText}`);
    }

    const aiData = await aiRes.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    if (!content) {
      throw new Error("No se recibió respuesta de la IA.");
    }

    // Limpieza de Markdown fences
    content = content.trim();
    if (content.startsWith("```json")) {
      content = content.substring(7);
    } else if (content.startsWith("```")) {
      content = content.substring(3);
    }
    if (content.endsWith("```")) {
      content = content.substring(0, content.length - 3);
    }
    content = content.trim();

    let leads: LeadResult[] = [];
    try {
      leads = JSON.parse(content);
      if (!Array.isArray(leads)) {
        throw new Error("La respuesta de la IA no es un array de leads válido.");
      }
    } catch (parseErr) {
      console.error("[AI-LEADS] Error al parsear JSON devuelto por la IA:", parseErr);
      console.log("Contenido recibido:", content);
      throw new Error("Error en el formato de datos devuelto por la IA. Inténtalo de nuevo.");
    }

    console.log(`[AI-LEADS] Encontrados ${leads.length} leads de la IA. Iniciando geocodificación...`);

    // Geocodificar cada lead usando la API de Google Maps
    const geocodedLeads = [];
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      let locationObj = undefined;

      // Autoclasificar teléfono por si Claude no lo hizo bien
      if (lead.phone) {
        lead.phoneType = classifySpanishPhone(lead.phone);
      }

      if (mapsKey && lead.address) {
        try {
          const searchQuery = `${lead.name}, ${lead.address}, ${location}`;
          console.log(`[AI-LEADS] Geocodificando: "${searchQuery}"`);
          const geoRes = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${mapsKey}&language=es`
          );
          const geoData = await geoRes.json();
          if (geoData.status === "OK" && geoData.results?.[0]?.geometry?.location) {
            locationObj = {
              lat: geoData.results[0].geometry.location.lat,
              lng: geoData.results[0].geometry.location.lng,
            };
          } else {
            // Reintento secundario con dirección sola
            const altGeoRes = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(lead.address + ", " + location)}&key=${mapsKey}&language=es`
            );
            const altGeoData = await altGeoRes.json();
            if (altGeoData.status === "OK" && altGeoData.results?.[0]?.geometry?.location) {
              locationObj = {
                lat: altGeoData.results[0].geometry.location.lat,
                lng: altGeoData.results[0].geometry.location.lng,
              };
            }
          }
        } catch (geoErr) {
          console.error(`[AI-LEADS] Fallo al geocodificar lead "${lead.name}":`, geoErr);
        }
      }

      geocodedLeads.push({
        ...lead,
        id: `ai-${Math.random().toString(36).substring(2, 11)}`, // ID único temporal
        placeId: `ai-place-${Math.random().toString(36).substring(2, 11)}`,
        location: locationObj,
      });
    }

    console.log(`[AI-LEADS] Procesamiento completado. Retornando ${geocodedLeads.length} leads.`);

    return new Response(
      JSON.stringify({ places: geocodedLeads, total: geocodedLeads.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AI-LEADS] Error general:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
