import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface WahaMessage {
  event: string;
  session: string;
  payload: {
    id: string;
    timestamp: number;
    from: string;
    to: string;
    fromMe: boolean;
    body: string;
    hasMedia: boolean;
    mediaUrl?: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key (simple security for webhook)
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("WAHA_WEBHOOK_SECRET") || "webhook-secret";
    
    if (apiKey && apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: WahaMessage = await req.json();
    console.log("Received WAHA webhook:", JSON.stringify(body, null, 2));

    // Only process message events
    if (body.event !== "message") {
      return new Response(JSON.stringify({ status: "ignored", event: body.event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = body.payload;
    
    // Extract phone number from chat_id (format: 34612345678@c.us)
    const chatId = payload.fromMe ? payload.to : payload.from;
    const phoneNumber = chatId.replace("@c.us", "").replace("@s.whatsapp.net", "");

    // Try to find a lead with matching phone number
    const { data: leads } = await supabase
      .from("leads")
      .select("id, user_id")
      .or(`phone.ilike.%${phoneNumber}%,phone.ilike.%${phoneNumber.slice(-9)}%`)
      .limit(1);

    const lead = leads?.[0];

    // Insert message into database
    // If we found a lead, use their user_id; otherwise we need a default user
    if (lead) {
      const { error: insertError } = await supabase.from("waha_messages").insert({
        chat_id: chatId,
        content: payload.body || "",
        from_me: payload.fromMe,
        timestamp: new Date(payload.timestamp * 1000).toISOString(),
        lead_id: lead.id,
        user_id: lead.user_id,
        message_id: payload.id,
        media_url: payload.mediaUrl || null,
      });

      if (insertError) {
        console.error("Error inserting message:", insertError);
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Message inserted successfully for lead:", lead.id);
    } else {
      console.log("No matching lead found for phone:", phoneNumber);
      // Still return success - we just don't store messages from unknown numbers
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
