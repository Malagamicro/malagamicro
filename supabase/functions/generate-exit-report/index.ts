import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { week_start, week_end } = await req.json();

    // Fetch exit records for the given week
    const { data: exits, error: exitsError } = await supabase
      .from("exit_records")
      .select("*")
      .gte("exit_date", week_start)
      .lte("exit_date", week_end)
      .order("exit_date", { ascending: true });

    if (exitsError) throw exitsError;

    if (!exits || exits.length === 0) {
      return new Response(
        JSON.stringify({ error: "No hay registros de salidas en ese periodo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format data for AI
    const exitData = exits.map((e: any) => 
      `- ${e.exit_date}: ${e.student_name} | Motivo: ${e.reason} | Destino: ${e.destination || 'N/A'} | Hora: ${e.exit_time || 'N/A'} - ${e.return_time || 'N/A'}`
    ).join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Actúa como un asistente administrativo profesional. Tu tarea es tomar datos crudos de registros de salidas (fecha, alumno/empleado, motivo, destino, horarios) y redactarlos en un informe formal, legible y bien estructurado para un supervisor. 
            
El informe debe incluir:
1. Encabezado con el periodo cubierto
2. Resumen ejecutivo (total de salidas, personas involucradas)
3. Detalle día a día de las salidas
4. Observaciones relevantes si las hay

Usa un tono profesional y formal. Escribe en español.`,
          },
          {
            role: "user",
            content: `Genera un informe semanal de salidas para el periodo ${week_start} a ${week_end}.\n\nDatos:\n${exitData}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de uso alcanzado, inténtalo más tarde" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error: " + aiResponse.status);
    }

    const aiData = await aiResponse.json();
    const reportContent = aiData.choices?.[0]?.message?.content || "No se pudo generar el informe";

    // Save the report
    const title = `Informe de Salidas - ${week_start} a ${week_end}`;
    const { error: insertError } = await supabase.from("reports").insert({
      title,
      content: reportContent,
      report_type: "exit_report",
      status: "generated",
      generated_by: user.id,
      week_start,
      week_end,
      source_data: { exits, exit_count: exits.length },
    });

    if (insertError) throw insertError;

    // Notify admin users
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: adminRoles } = await serviceClient.from("user_roles").select("user_id").eq("role", "admin");
    
    if (adminRoles && adminRoles.length > 0) {
      for (const admin of adminRoles) {
        if (admin.user_id !== user.id) {
          await serviceClient.from("budget_notifications").insert({
            user_id: admin.user_id,
            message: `Nuevo informe de salidas disponible: ${title}`,
            type: "info",
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, title }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-exit-report error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
