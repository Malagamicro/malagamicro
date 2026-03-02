import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!openrouterKey) throw new Error("OPENROUTER_API_KEY not configured");

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch login history
    const { data: loginLogs } = await adminClient
      .from("user_login_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    // Fetch existing blocks
    const { data: existingBlocks } = await adminClient
      .from("login_security_blocks")
      .select("user_id, ip_address, is_active, reason")
      .limit(100);

    // Fetch user profiles for context
    const { data: profiles } = await adminClient.from("profiles").select("user_id, full_name");

    // Enrich with emails
    const userIds = [...new Set((loginLogs || []).map(l => l.user_id))];
    const emailMap: Record<string, string> = {};
    for (const uid of userIds) {
      const { data: userData } = await adminClient.auth.admin.getUserById(uid);
      if (userData?.user?.email) emailMap[uid] = userData.user.email;
    }

    const profileMap: Record<string, string> = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p.full_name || ""; });

    // Build analysis data
    const logsForAI = (loginLogs || []).map(log => ({
      user_email: emailMap[log.user_id] || "unknown",
      user_name: profileMap[log.user_id] || "",
      ip: log.ip_address,
      city: log.city,
      region: log.region,
      country: log.country,
      device: log.device_type,
      user_agent: log.user_agent?.substring(0, 100),
      date: log.created_at,
      lat: log.latitude,
      lon: log.longitude,
    }));

    const blocksForAI = (existingBlocks || []).map(b => ({
      user_email: emailMap[b.user_id] || "unknown",
      ip: b.ip_address,
      active: b.is_active,
      reason: b.reason,
    }));

    const systemPrompt = `Eres un analista de ciberseguridad experto. Analiza los registros de login de una aplicación CRM empresarial española (MalagaMicro CRM).

Tu trabajo es clasificar cada IP y sesión de login como:
- ✅ FAMILIAR: IP conocida, ubicación habitual del usuario, patrón normal
- ⚠️ SOSPECHOSA: Ubicación inusual, cambio brusco de geolocalización, IP de datacenter/VPN no esperada
- 🚨 PELIGROSA: Múltiples intentos fallidos, país completamente ajeno, patrón de fuerza bruta

Contexto importante:
- La empresa está en Málaga, España. Logins desde Málaga y ciudades cercanas son normales.
- IPs de AWS/cloud (44.x, 52.x) pueden ser del entorno de preview de Lovable y son NORMALES.
- IPs móviles españolas pueden cambiar frecuentemente, esto es normal.
- Usuarios viajando por España es normal.

Responde en JSON con esta estructura exacta:
{
  "summary": "Resumen ejecutivo en español de la situación de seguridad",
  "risk_level": "low" | "medium" | "high",
  "familiar_ips": [{"ip": "x.x.x.x", "reason": "motivo", "user": "email"}],
  "suspicious_ips": [{"ip": "x.x.x.x", "reason": "motivo", "user": "email", "recommendation": "acción recomendada"}],
  "dangerous_ips": [{"ip": "x.x.x.x", "reason": "motivo", "user": "email", "recommendation": "acción recomendada"}],
  "user_analysis": [{"user": "email", "status": "safe|monitored|at_risk", "notes": "observaciones"}],
  "recommendations": ["recomendación 1", "recomendación 2"]
}`;

    const userPrompt = `Analiza estos registros de login:

LOGINS RECIENTES (${logsForAI.length} registros):
${JSON.stringify(logsForAI, null, 2)}

BLOQUEOS EXISTENTES:
${JSON.stringify(blocksForAI, null, 2)}

Proporciona un análisis detallado de seguridad clasificando cada IP.`;

    console.log("[analyze-ip] Calling AI with", logsForAI.length, "login records");

    const aiResponse = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://malagamicro.lovable.app",
        "X-Title": "MalagaMicro CRM Security",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[analyze-ip] AI error:", aiResponse.status, errText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1]);
      } else {
        analysis = { summary: content, risk_level: "unknown", familiar_ips: [], suspicious_ips: [], dangerous_ips: [], user_analysis: [], recommendations: [] };
      }
    }

    console.log("[analyze-ip] Analysis complete. Risk level:", analysis.risk_level);

    return new Response(JSON.stringify({ analysis, model_used: aiData._model_used || "gemini-2.5-flash" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[analyze-ip] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
