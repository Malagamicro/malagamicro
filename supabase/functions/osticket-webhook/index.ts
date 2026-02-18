import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OsTicketPayload {
  ticket_id?: string;
  number?: string;
  subject?: string;
  name?: string;
  email?: string;
  department?: string;
  priority?: string;
  message?: string;
  [key: string]: unknown;
}

interface OsTicketConfig {
  id: string;
  user_id: string;
  osticket_url: string;
  api_key: string;
  notification_numbers: string[];
  message_template: string;
  is_enabled: boolean;
}

// Evolution API configuration
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "https://evolutionapi.malagamicro.com").replace(/\/+$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
const INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "CRM";

function formatPhoneNumber(phone: string): string {
  let cleanPhone = phone.replace(/\D/g, "");
  cleanPhone = cleanPhone.replace(/^0+/, "");
  if (cleanPhone.length === 9) {
    cleanPhone = "34" + cleanPhone;
  }
  console.log(`📱 Formatted phone: ${phone} -> ${cleanPhone}`);
  return cleanPhone;
}

function stripHtml(html: string): string {
  if (!html) return "";
  
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<h[1-6][^>]*>/gi, "*")
    .replace(/<\/?(?:b|strong)[^>]*>/gi, "*")
    .replace(/<\/?(?:i|em)[^>]*>/gi, "_")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    const cleanPhone = formatPhoneNumber(phone);
    const apiUrl = `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`;
    console.log(`📤 Sending WhatsApp via Evolution API to ${cleanPhone}`);
    console.log(`🔗 Evolution URL: ${apiUrl}`);
    console.log(`🔑 API Key configured: ${EVOLUTION_API_KEY ? "YES (length: " + EVOLUTION_API_KEY.length + ")" : "NO"}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send WhatsApp: ${response.status} - ${errorText}`);
      return false;
    }

    console.log(`✅ WhatsApp sent successfully to ${phone} via Evolution API`);
    return true;
  } catch (error) {
    console.error(`Error sending WhatsApp to ${phone}:`, error);
    return false;
  }
}

function renderTemplate(template: string, data: OsTicketPayload, osticketUrl: string): string {
  const ticketUrl = `${osticketUrl}/scp/tickets.php?id=${data.ticket_id || ""}`;
  
  const cleanMessage = stripHtml(data.message || "");
  const cleanSubject = stripHtml(data.subject || "Sin asunto");
  const cleanName = stripHtml(data.name || "N/A");
  
  return template
    .replace(/\{\{ticket_id\}\}/g, data.ticket_id || "N/A")
    .replace(/\{\{number\}\}/g, data.number || "N/A")
    .replace(/\{\{subject\}\}/g, cleanSubject)
    .replace(/\{\{name\}\}/g, cleanName)
    .replace(/\{\{email\}\}/g, data.email || "N/A")
    .replace(/\{\{department\}\}/g, data.department || "N/A")
    .replace(/\{\{priority\}\}/g, data.priority || "Normal")
    .replace(/\{\{message\}\}/g, cleanMessage)
    .replace(/\{\{ticket_url\}\}/g, ticketUrl);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const headerApiKey = req.headers.get("x-api-key");
    const authHeader = req.headers.get("authorization");
    const queryApiKey = url.searchParams.get("api_key");

    const bearerRaw = authHeader?.replace(/^Bearer\s+/i, "") || null;
    const bearerLooksLikeJwt = !!(bearerRaw && bearerRaw.split(".").length === 3);

    const providedApiKey =
      headerApiKey ||
      queryApiKey ||
      (bearerLooksLikeJwt ? null : bearerRaw);

    const keySource = headerApiKey
      ? "header:x-api-key"
      : queryApiKey
        ? "query:api_key"
        : bearerRaw
          ? (bearerLooksLikeJwt ? "authorization:jwt(ignored)" : "authorization:bearer")
          : "none";

    console.log(`🔐 Auth check - Key source: ${keySource}`);

    if (!providedApiKey) {
      console.error("❌ No API key provided in request");
      return new Response(
        JSON.stringify({ error: "Unauthorized - API key required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: matchingConfigs, error: authError } = await supabase
      .from("osticket_config")
      .select("*")
      .eq("api_key", providedApiKey.trim())
      .eq("is_enabled", true);

    if (authError) {
      console.error("Error validating API key:", authError);
      return new Response(
        JSON.stringify({ error: "Authentication error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!matchingConfigs || matchingConfigs.length === 0) {
      console.error(`❌ Unauthorized - API key not found or config disabled`);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Webhook authenticated via osticket_config (${matchingConfigs.length} matching config(s))`);

    let payload: OsTicketPayload;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("📥 Received osTicket webhook:", JSON.stringify(payload, null, 2));

    const configs = matchingConfigs;

    let totalSent = 0;
    let totalFailed = 0;
    let ticketSavedToHistory = false;

    if (payload.ticket_id) {
      const { data: existingTickets } = await supabase
        .from("osticket_tickets")
        .select("id")
        .eq("ticket_id", payload.ticket_id)
        .limit(1);

      if (existingTickets && existingTickets.length > 0) {
        console.log(`⚠️ Ticket ${payload.ticket_id} already processed, skipping duplicate`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Duplicate ticket ignored", 
            duplicate: true,
            ticket_id: payload.ticket_id 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    for (const config of configs as OsTicketConfig[]) {
      if (!config.notification_numbers || config.notification_numbers.length === 0) {
        console.log(`Config ${config.id} has no notification numbers, skipping`);
        continue;
      }

      const message = renderTemplate(
        config.message_template,
        payload,
        config.osticket_url
      );

      console.log(`Sending to ${config.notification_numbers.length} numbers for config ${config.id}`);

      if (!ticketSavedToHistory) {
        const { error: insertError } = await supabase
          .from("osticket_tickets")
          .insert({
            user_id: config.user_id,
            ticket_id: payload.ticket_id || null,
            ticket_number: payload.number || null,
            subject: payload.subject || "Sin asunto",
            customer_name: payload.name || null,
            customer_email: payload.email || null,
            department: payload.department || null,
            priority: payload.priority || null,
            message: payload.message || null,
            notification_sent: true,
            notification_phone: config.notification_numbers.join(", "),
          });

        if (insertError) {
          console.error("Error saving ticket to history:", insertError);
        } else {
          console.log("📝 Ticket saved to history (once)");
          ticketSavedToHistory = true;
        }
      }

      for (const phone of config.notification_numbers) {
        if (totalSent > 0 || totalFailed > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        const success = await sendWhatsAppMessage(phone, message);

        if (success) {
          totalSent++;
        } else {
          totalFailed++;
        }
      }
    }

    console.log(`📊 Webhook processed: ${totalSent} sent, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notifications sent via Evolution API`,
        sent: totalSent,
        failed: totalFailed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
