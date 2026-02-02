import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get N8N webhook URL from secrets
    const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
    if (!n8nWebhookUrl) {
      console.error("N8N_WEBHOOK_URL not configured");
      return new Response(JSON.stringify({ error: "Service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Invalid prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmedPrompt = prompt.trim();

    // Try POST first, then GET as fallback
    let response: Response;

    try {
      response = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt, userId: user.id }),
      });
    } catch {
      // Network error, try GET
      const url = `${n8nWebhookUrl}?prompt=${encodeURIComponent(trimmedPrompt)}`;
      response = await fetch(url, { method: "GET" });
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");

      // Check if n8n only accepts GET
      const looksLikeMethodMismatch =
        response.status === 404 &&
        bodyText.toLowerCase().includes("not registered for post") &&
        bodyText.toLowerCase().includes("get request");

      if (looksLikeMethodMismatch) {
        const url = `${n8nWebhookUrl}?prompt=${encodeURIComponent(trimmedPrompt)}`;
        response = await fetch(url, { method: "GET" });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(`n8n error ${response.status}: ${errorText || "No response"}`);
        }
      } else {
        throw new Error(`n8n error ${response.status}: ${bodyText || "No response"}`);
      }
    }

    // Return the response from n8n
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Budget proxy error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
