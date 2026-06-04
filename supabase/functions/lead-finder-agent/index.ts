import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const tools = [
  {
    type: "function",
    function: {
      name: "search_google_maps",
      description: "Buscar empresas/negocios en Google Maps por tipo, ubicación y palabras clave. Ideal para encontrar leads por zona geográfica.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto de búsqueda (ej: 'clínicas dentales', 'restaurantes italianos')" },
          location: { type: "string", description: "Ciudad o zona (ej: 'Málaga', 'Madrid centro')" },
          radius_km: { type: "number", description: "Radio de búsqueda en km (default 10)" },
        },
        required: ["query", "location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_web_sonar",
      description: "Buscar información en la web usando IA Sonar Pro. Perfecto para encontrar empresas, directorios, noticias de negocios, contactos empresariales, etc.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Consulta de búsqueda web (ej: 'empresas de reformas en Sevilla contacto', 'directorio clínicas veterinarias Madrid')" },
          search_recency: { type: "string", enum: ["day", "week", "month", "year"], description: "Filtrar resultados por fecha reciente" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_lead",
      description: "Guardar un lead encontrado en el CRM. Usa esta herramienta cuando encuentres un negocio/empresa relevante para el usuario.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Nombre de la empresa" },
          contact_name: { type: "string", description: "Nombre del contacto" },
          phone: { type: "string", description: "Teléfono" },
          email: { type: "string", description: "Email" },
          city: { type: "string", description: "Ciudad" },
          address: { type: "string", description: "Dirección" },
          website: { type: "string", description: "Sitio web" },
          notes: { type: "string", description: "Notas sobre el lead" },
          source: { type: "string", description: "Fuente (google_maps, web_search, manual)" },
          segment: { type: "string", enum: ["pyme", "autonomo", "corporativo"], description: "Segmento" },
        },
        required: ["company_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_multiple_leads",
      description: "Guardar múltiples leads de una vez. Úsalo cuando encuentres varios resultados relevantes.",
      parameters: {
        type: "object",
        properties: {
          leads: {
            type: "array",
            items: {
              type: "object",
              properties: {
                company_name: { type: "string" },
                contact_name: { type: "string" },
                phone: { type: "string" },
                email: { type: "string" },
                city: { type: "string" },
                address: { type: "string" },
                website: { type: "string" },
                notes: { type: "string" },
                source: { type: "string" },
              },
              required: ["company_name"],
            },
            description: "Array de leads a guardar",
          },
        },
        required: ["leads"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_existing_leads",
      description: "Verificar si una empresa ya existe como lead en el CRM para evitar duplicados.",
      parameters: {
        type: "object",
        properties: {
          company_names: {
            type: "array",
            items: { type: "string" },
            description: "Nombres de empresas a verificar",
          },
        },
        required: ["company_names"],
      },
    },
  },
];

async function searchGoogleMaps(query: string, location: string, radiusKm: number = 10): Promise<any> {
  const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!GOOGLE_MAPS_API_KEY) return { error: "Google Maps API key no configurada" };

  try {
    // First geocode the location
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.[0]) return { error: "No se pudo geocodificar la ubicación", places: [] };

    const { lat, lng } = geoData.results[0].geometry.location;

    // Text search
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + " " + location)}&location=${lat},${lng}&radius=${radiusKm * 1000}&key=${GOOGLE_MAPS_API_KEY}&language=es`
    );
    const searchData = await searchRes.json();

    const places = [];
    for (const place of (searchData.results || []).slice(0, 15)) {
      // Get details for phone/website
      const detailRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,website,name,formatted_address,rating,user_ratings_total&key=${GOOGLE_MAPS_API_KEY}&language=es`
      );
      const detailData = await detailRes.json();
      const d = detailData.result || {};

      places.push({
        name: d.name || place.name,
        address: d.formatted_address || place.formatted_address,
        phone: d.formatted_phone_number || null,
        website: d.website ? d.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : null,
        rating: d.rating || place.rating,
        reviews: d.user_ratings_total || place.user_ratings_total,
        placeId: place.place_id,
        lat: place.geometry?.location?.lat,
        lng: place.geometry?.location?.lng,
      });
    }

    return { places, total: places.length, location: { lat, lng } };
  } catch (e) {
    console.error("Google Maps search error:", e);
    return { error: e.message, places: [] };
  }
}

async function searchWebSonar(query: string, recency?: string): Promise<any> {
  const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
  if (!PERPLEXITY_API_KEY) return { error: "Perplexity API key no configurada" };

  try {
    const body: any = {
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: "Eres un experto en prospección comercial. Cuando busques empresas, extrae siempre: nombre de empresa, teléfono, email, dirección, web y cualquier dato de contacto disponible. Presenta los resultados de forma estructurada."
        },
        { role: "user", content: query }
      ],
    };
    if (recency) body.search_recency_filter = recency;

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || "Sin resultados",
      citations: data.citations || [],
    };
  } catch (e) {
    console.error("Sonar search error:", e);
    return { error: e.message };
  }
}

async function executeTool(supabase: any, userId: string, name: string, args: any): Promise<string> {
  try {
    switch (name) {
      case "search_google_maps": {
        const result = await searchGoogleMaps(args.query, args.location, args.radius_km);
        return JSON.stringify(result);
      }
      case "search_web_sonar": {
        const result = await searchWebSonar(args.query, args.search_recency);
        return JSON.stringify(result);
      }
      case "save_lead": {
        const { data, error } = await supabase.from("leads").insert({
          company_name: args.company_name,
          contact_name: args.contact_name || null,
          phone: args.phone || null,
          email: args.email || null,
          city: args.city || "Sin especificar",
          address: args.address || null,
          website: args.website || null,
          notes: args.notes || null,
          source: args.source || "ai_agent",
          segment: args.segment || "pyme",
          status: "nuevo",
          user_id: userId,
        }).select().single();

        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, lead: { id: data.id, company_name: data.company_name } });
      }
      case "save_multiple_leads": {
        const leadsToInsert = (args.leads || []).map((l: any) => ({
          company_name: l.company_name,
          contact_name: l.contact_name || null,
          phone: l.phone || null,
          email: l.email || null,
          city: l.city || "Sin especificar",
          address: l.address || null,
          website: l.website || null,
          notes: l.notes || null,
          source: l.source || "ai_agent",
          segment: "pyme",
          status: "nuevo",
          user_id: userId,
        }));

        const { data, error } = await supabase.from("leads").insert(leadsToInsert).select();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, saved: data.length, leads: data.map((d: any) => ({ id: d.id, company_name: d.company_name })) });
      }
      case "check_existing_leads": {
        const names = args.company_names || [];
        const { data } = await supabase
          .from("leads")
          .select("company_name")
          .eq("user_id", userId)
          .in("company_name", names);

        const existing = (data || []).map((d: any) => d.company_name);
        return JSON.stringify({ existing, new_ones: names.filter((n: string) => !existing.includes(n)) });
      }
      default:
        return JSON.stringify({ error: `Herramienta '${name}' no encontrada` });
    }
  } catch (e) {
    console.error(`Tool error (${name}):`, e);
    return JSON.stringify({ error: e.message });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY no configurada");

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user
    let userId = "";
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await anonClient.auth.getUser(token);
      if (user) userId = user.id;
    }

    const systemPrompt = `Eres un agente inteligente de prospección de leads para MalagaMicro CRM. Tu objetivo es ayudar a encontrar potenciales clientes usando múltiples fuentes:

1. **Google Maps**: Busca negocios por zona geográfica, tipo de negocio y ubicación.
2. **Búsqueda Web (Sonar Pro)**: Busca en internet directorios, noticias, empresas, contactos comerciales.

INSTRUCCIONES:
- Cuando el usuario pida buscar leads, usa AMBAS herramientas en paralelo para maximizar resultados.
- Primero busca en Google Maps para datos de contacto fiables (teléfono, dirección).
- Luego busca en la web para encontrar más empresas, emails, información adicional.
- SIEMPRE pregunta si quiere guardar los resultados antes de usar save_lead/save_multiple_leads.
- Verifica duplicados con check_existing_leads antes de guardar.
- Presenta los resultados en formato tabla/lista organizada.
- Si el usuario da una ciudad o zona, úsala. Si no, pregunta.
- Muestra valoraciones, teléfonos, webs y toda info útil.
- Responde siempre en español.`;

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Agent loop: call OpenRouter, handle tool calls, repeat
    const maxIterations = 5;
    let finalResponse = "";

    for (let i = 0; i < maxIterations; i++) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: chatMessages,
          tools,
          tool_choice: "auto",
          max_tokens: 4096,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("OpenRouter error:", res.status, errText);
        throw new Error(`AI error: ${res.status}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      if (!choice) throw new Error("No response from AI");

      const msg = choice.message;
      chatMessages.push(msg);

      // If no tool calls, we're done
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        finalResponse = msg.content || "";
        break;
      }

      // Execute all tool calls
      for (const tc of msg.tool_calls) {
        const args = JSON.parse(tc.function.arguments);
        console.log(`Executing tool: ${tc.function.name}`, args);
        const result = await executeTool(supabase, userId, tc.function.name, args);
        chatMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }
    }

    return new Response(JSON.stringify({ response: finalResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Lead finder agent error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
