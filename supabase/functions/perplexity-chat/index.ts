import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

const tools = [
  {
    type: "function",
    function: {
      name: "search_leads",
      description: "Buscar leads por nombre de empresa, contacto, teléfono, email o ciudad. Usa esto cuando el usuario pregunte sobre leads específicos o quiera encontrar información.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto a buscar" },
          status: { type: "string", enum: ["nuevo", "contactado", "interesado", "cliente"], description: "Filtrar por estado" },
          limit: { type: "number", description: "Número máximo de resultados (default 5)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_lead_stats",
      description: "Obtener estadísticas generales de leads: total, por estado, tasa de conversión, leads recientes. Usa esto cuando el usuario pregunte por métricas, reportes o estadísticas.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Crear un nuevo lead. Usa esto cuando el usuario quiera añadir un nuevo lead o prospecto.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Nombre de la empresa (requerido)" },
          contact_name: { type: "string", description: "Nombre del contacto" },
          phone: { type: "string", description: "Teléfono" },
          email: { type: "string", description: "Email" },
          city: { type: "string", description: "Ciudad (default: Málaga)" },
          notes: { type: "string", description: "Notas adicionales" },
        },
        required: ["company_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead",
      description: "Actualizar un lead existente. Usa esto cuando el usuario quiera modificar información de un lead.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID del lead a actualizar" },
          company_name: { type: "string" },
          contact_name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          status: { type: "string", enum: ["nuevo", "contactado", "interesado", "cliente"] },
          notes: { type: "string" },
        },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_activities",
      description: "Obtener actividades recientes del CRM: últimos leads creados, últimas interacciones. Usa esto para mostrar actividad reciente.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Número de actividades (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_reminders",
      description: "Obtener recordatorios pendientes. Usa esto cuando el usuario pregunte por tareas o seguimientos pendientes.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

async function executeToolCall(
  supabase: any,
  userId: string,
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  try {
    switch (toolName) {
      case "search_leads": {
        const query = args.query?.toLowerCase() || "";
        const limit = args.limit || 5;
        
        let queryBuilder = supabase
          .from("leads")
          .select("id, company_name, contact_name, phone, email, city, status, score, notes")
          .eq("user_id", userId)
          .or(`company_name.ilike.%${query}%,contact_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%,city.ilike.%${query}%`)
          .limit(limit);
        
        if (args.status) {
          queryBuilder = queryBuilder.eq("status", args.status);
        }
        
        const { data, error } = await queryBuilder;
        if (error) throw error;
        
        if (!data || data.length === 0) {
          return JSON.stringify({ message: "No se encontraron leads con ese criterio", results: [] });
        }
        
        return JSON.stringify({
          message: `Encontrados ${data.length} leads`,
          results: data.map((l: any) => ({
            id: l.id,
            empresa: l.company_name,
            contacto: l.contact_name,
            telefono: l.phone,
            email: l.email,
            ciudad: l.city,
            estado: l.status,
            score: l.score,
            notas: l.notes?.substring(0, 100),
          })),
        });
      }
      
      case "get_lead_stats": {
        const { data: leads, error } = await supabase
          .from("leads")
          .select("status, created_at")
          .eq("user_id", userId);
        
        if (error) throw error;
        
        const total = leads?.length || 0;
        const byStatus = {
          nuevo: leads?.filter((l: any) => l.status === "nuevo").length || 0,
          contactado: leads?.filter((l: any) => l.status === "contactado").length || 0,
          interesado: leads?.filter((l: any) => l.status === "interesado").length || 0,
          cliente: leads?.filter((l: any) => l.status === "cliente").length || 0,
        };
        
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentLeads = leads?.filter((l: any) => new Date(l.created_at) > weekAgo).length || 0;
        
        const conversionRate = total > 0 ? ((byStatus.cliente / total) * 100).toFixed(1) : 0;
        
        return JSON.stringify({
          total_leads: total,
          por_estado: byStatus,
          leads_esta_semana: recentLeads,
          tasa_conversion: `${conversionRate}%`,
        });
      }
      
      case "create_lead": {
        const { data, error } = await supabase
          .from("leads")
          .insert({
            user_id: userId,
            company_name: args.company_name,
            contact_name: args.contact_name || null,
            phone: args.phone || null,
            email: args.email || null,
            city: args.city || "Málaga",
            notes: args.notes || null,
            status: "nuevo",
            segment: "pyme",
            source: "manual",
          })
          .select("id, company_name")
          .single();
        
        if (error) throw error;
        
        return JSON.stringify({
          success: true,
          message: `Lead "${data.company_name}" creado exitosamente`,
          lead_id: data.id,
        });
      }
      
      case "update_lead": {
        const { lead_id, ...updateData } = args;
        const updateFields: Record<string, any> = {};
        
        if (updateData.company_name) updateFields.company_name = updateData.company_name;
        if (updateData.contact_name) updateFields.contact_name = updateData.contact_name;
        if (updateData.phone) updateFields.phone = updateData.phone;
        if (updateData.email) updateFields.email = updateData.email;
        if (updateData.status) updateFields.status = updateData.status;
        if (updateData.notes) updateFields.notes = updateData.notes;
        
        const { data, error } = await supabase
          .from("leads")
          .update(updateFields)
          .eq("id", lead_id)
          .eq("user_id", userId)
          .select("id, company_name")
          .single();
        
        if (error) throw error;
        
        return JSON.stringify({
          success: true,
          message: `Lead "${data.company_name}" actualizado`,
        });
      }
      
      case "get_recent_activities": {
        const limit = args.limit || 10;
        
        const { data: activities, error } = await supabase
          .from("lead_activities")
          .select("id, type, description, created_at, lead_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit);
        
        if (error) throw error;
        
        return JSON.stringify({
          actividades: activities?.map((a: any) => ({
            tipo: a.type,
            descripcion: a.description,
            fecha: new Date(a.created_at).toLocaleDateString("es-ES"),
          })) || [],
        });
      }
      
      case "get_pending_reminders": {
        const { data: reminders, error } = await supabase
          .from("follow_up_reminders")
          .select("id, message, reminder_date, lead_id, leads(company_name)")
          .eq("user_id", userId)
          .eq("is_completed", false)
          .gte("reminder_date", new Date().toISOString())
          .order("reminder_date", { ascending: true })
          .limit(10);
        
        if (error) throw error;
        
        return JSON.stringify({
          recordatorios_pendientes: reminders?.map((r: any) => ({
            mensaje: r.message,
            fecha: new Date(r.reminder_date).toLocaleDateString("es-ES"),
            empresa: r.leads?.company_name,
          })) || [],
        });
      }
      
      default:
        return JSON.stringify({ error: `Herramienta desconocida: ${toolName}` });
    }
  } catch (err: any) {
    console.error(`Tool error (${toolName}):`, err);
    return JSON.stringify({ error: err.message });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      throw new Error("PERPLEXITY_API_KEY is not configured");
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { messages, model = "sonar" } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error("Messages array is required");
    }

    const validModels = ["sonar", "sonar-pro", "sonar-reasoning"];
    const selectedModel = validModels.includes(model) ? model : "sonar";

    const systemPrompt = `Eres un asistente de CRM inteligente para gestión de leads y clientes. Tienes acceso a herramientas para:
- Buscar y consultar leads existentes
- Ver estadísticas y métricas del negocio
- Crear nuevos leads
- Actualizar información de leads
- Ver actividades recientes
- Consultar recordatorios pendientes

Responde siempre en español de forma amigable y profesional. Cuando el usuario pregunte sobre datos, usa las herramientas disponibles. Si necesitas el ID de un lead para actualizarlo, primero búscalo por nombre.

Formato tus respuestas con markdown cuando sea útil (listas, negritas, etc.).`;

    // First call to get tool calls
    const initialResponse = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: userId ? tools : undefined,
        stream: false,
      }),
    });

    if (!initialResponse.ok) {
      const errorText = await initialResponse.text();
      console.error("Perplexity API error:", initialResponse.status, errorText);
      
      if (initialResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de peticiones excedido. Intenta de nuevo." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`API error: ${initialResponse.status}`);
    }

    const initialData = await initialResponse.json();
    const assistantMessage = initialData.choices?.[0]?.message;

    // Check if there are tool calls
    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && userId) {
      const toolResults: ChatMessage[] = [];
      
      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeToolCall(supabase, userId, toolCall.function.name, args);
        
        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Second call with tool results
      const finalResponse = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            assistantMessage,
            ...toolResults,
          ],
          stream: true,
        }),
      });

      if (!finalResponse.ok) {
        throw new Error(`Final API error: ${finalResponse.status}`);
      }

      return new Response(finalResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls, stream directly
    const streamResponse = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    return new Response(streamResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
