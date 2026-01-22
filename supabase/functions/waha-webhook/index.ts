import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface WahaPayload {
  id: string;
  timestamp: number;
  from: string;
  to: string;
  fromMe: boolean;
  body: string;
  hasMedia: boolean;
  mediaUrl?: string;
}

interface WahaWebhook {
  event: string;
  session: string;
  payload: WahaPayload;
}

Deno.serve(async (req) => {
  console.log("=== WAHA Webhook received ===");
  console.log("Method:", req.method);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log headers for debugging
    const apiKey = req.headers.get("x-api-key");
    console.log("Has API Key header:", !!apiKey);

    // Optional API key validation (skip if not configured)
    const expectedKey = Deno.env.get("WAHA_WEBHOOK_SECRET");
    if (expectedKey && apiKey && apiKey !== expectedKey) {
      console.log("Unauthorized: API key mismatch");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();
    console.log("Raw body:", rawBody);

    let body: WahaWebhook;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Event type:", body.event);
    console.log("Session:", body.session);

    // Only process message events
    if (body.event !== "message") {
      console.log("Ignoring non-message event:", body.event);
      return new Response(JSON.stringify({ status: "ignored", event: body.event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = body.payload;
    if (!payload) {
      console.error("No payload in message");
      return new Response(JSON.stringify({ error: "No payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Payload:", JSON.stringify(payload, null, 2));
    console.log("fromMe:", payload.fromMe);
    console.log("body:", payload.body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase credentials");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract chat ID - for incoming messages, use 'from'; for outgoing, use 'to'
    const chatId = payload.fromMe ? payload.to : payload.from;
    const phoneNumber = chatId.replace("@c.us", "").replace("@s.whatsapp.net", "");

    console.log("Chat ID:", chatId);
    console.log("Phone number:", phoneNumber);

    // Try to find a lead with matching phone number
    const { data: leads, error: leadError } = await supabase
      .from("leads")
      .select("id, user_id")
      .or(`phone.ilike.%${phoneNumber}%,phone.ilike.%${phoneNumber.slice(-9)}%`)
      .limit(1);

    if (leadError) {
      console.error("Error searching for lead:", leadError);
    }

    const lead = leads?.[0];
    console.log("Found lead:", lead ? lead.id : "none");

    // If no lead found, we need to find a user to assign this message to
    // Get the first user in the system (or a default admin)
    let userId = lead?.user_id;
    
    if (!userId) {
      // Try to get any user from profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .limit(1);
      
      userId = profiles?.[0]?.user_id;
      console.log("Using fallback user_id:", userId);
    }

    if (!userId) {
      console.error("No user found to assign message to");
      // Still return OK to WAHA, but log the issue
      return new Response(JSON.stringify({ status: "ok", warning: "no user to assign" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate proper timestamp
    const messageTimestamp = payload.timestamp 
      ? new Date(payload.timestamp * 1000).toISOString()
      : new Date().toISOString();

    // Insert message into database
    const insertData = {
      chat_id: chatId,
      content: payload.body || "",
      from_me: payload.fromMe ?? false,
      timestamp: messageTimestamp,
      lead_id: lead?.id || null,
      user_id: userId,
      message_id: payload.id || null,
      media_url: payload.mediaUrl || null,
    };

    console.log("Inserting message:", JSON.stringify(insertData, null, 2));

    const { error: insertError } = await supabase
      .from("waha_messages")
      .insert(insertData);

    if (insertError) {
      console.error("Error inserting message:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ Message inserted successfully!");
    console.log("   - Chat:", chatId);
    console.log("   - From me:", payload.fromMe);
    console.log("   - Lead:", lead?.id || "none");

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", message);
    console.error("Full error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
