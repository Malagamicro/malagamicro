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
  // Allow other fields osTicket might send
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

// WAHA API configuration - using environment variables
const WAHA_API_URL_RAW = Deno.env.get("WAHA_API_URL") || "http://localhost:3000";
// Remove trailing slash to avoid double slashes
const WAHA_API_URL = WAHA_API_URL_RAW.replace(/\/+$/, "");
const WAHA_API_KEY = Deno.env.get("WAHA_API_KEY") || "";
const SESSION_NAME = "default";

function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters (including +, spaces, dashes)
  let cleanPhone = phone.replace(/\D/g, "");
  
  // Handle different formats:
  // +34651660185 -> 34651660185 (already has country code)
  // 651660185 -> 34651660185 (add Spain country code)
  // 0034651660185 -> 34651660185 (remove leading zeros)
  
  // Remove leading zeros
  cleanPhone = cleanPhone.replace(/^0+/, "");
  
  // If it's a 9-digit number (Spanish mobile without country code), add 34
  if (cleanPhone.length === 9) {
    cleanPhone = "34" + cleanPhone;
  }
  
  console.log(`📱 Formatted phone: ${phone} -> ${cleanPhone}`);
  return cleanPhone;
}

function buildChatId(phone: string): string {
  const cleanPhone = formatPhoneNumber(phone);
  return `${cleanPhone}@c.us`;
}

async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    const chatId = buildChatId(phone);
    const apiUrl = `${WAHA_API_URL}/api/sendText`;
    console.log(`📤 Sending WhatsApp to ${chatId}`);
    console.log(`🔗 WAHA URL: ${apiUrl}`);
    console.log(`🔑 API Key configured: ${WAHA_API_KEY ? "YES (length: " + WAHA_API_KEY.length + ")" : "NO"}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": WAHA_API_KEY,
      },
      body: JSON.stringify({
        chatId,
        text: message,
        session: SESSION_NAME,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send WhatsApp: ${response.status} - ${errorText}`);
      return false;
    }

    console.log(`✅ WhatsApp sent successfully to ${phone}`);
    return true;
  } catch (error) {
    console.error(`Error sending WhatsApp to ${phone}:`, error);
    return false;
  }
}

function renderTemplate(template: string, data: OsTicketPayload, osticketUrl: string): string {
  const ticketUrl = `${osticketUrl}/scp/tickets.php?id=${data.ticket_id || ""}`;
  
  return template
    .replace(/\{\{ticket_id\}\}/g, data.ticket_id || "N/A")
    .replace(/\{\{number\}\}/g, data.number || "N/A")
    .replace(/\{\{subject\}\}/g, data.subject || "Sin asunto")
    .replace(/\{\{name\}\}/g, data.name || "N/A")
    .replace(/\{\{email\}\}/g, data.email || "N/A")
    .replace(/\{\{department\}\}/g, data.department || "N/A")
    .replace(/\{\{priority\}\}/g, data.priority || "Normal")
    .replace(/\{\{message\}\}/g, data.message || "")
    .replace(/\{\{ticket_url\}\}/g, ticketUrl);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only accept POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MANDATORY authentication - webhook secret is required
    const webhookApiKey = Deno.env.get("WAHA_WEBHOOK_SECRET");
    
    if (!webhookApiKey) {
      console.error("❌ WAHA_WEBHOOK_SECRET not configured - webhook disabled for security");
      return new Response(
        JSON.stringify({ error: "Webhook not properly configured. WAHA_WEBHOOK_SECRET is required." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for API key in multiple places
    const url = new URL(req.url);
    const providedApiKey = 
      req.headers.get("x-api-key") || 
      req.headers.get("authorization")?.replace("Bearer ", "") ||
      url.searchParams.get("api_key");

    if (!providedApiKey || webhookApiKey !== providedApiKey) {
      console.error("❌ Unauthorized webhook request - invalid or missing API key");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Webhook authenticated successfully");

    // Parse the incoming payload from osTicket
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

    // Initialize Supabase client with service role for reading all configs
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all enabled osTicket configs
    const { data: configs, error: configError } = await supabase
      .from("osticket_config")
      .select("*")
      .eq("is_enabled", true);

    if (configError) {
      console.error("Error fetching osTicket configs:", configError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch configurations" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!configs || configs.length === 0) {
      console.log("No enabled osTicket configurations found");
      return new Response(
        JSON.stringify({ message: "No enabled configurations", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;
    let totalFailed = 0;

    // Check for duplicate ticket to prevent re-processing
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

    // Process each enabled config
    for (const config of configs as OsTicketConfig[]) {
      if (!config.notification_numbers || config.notification_numbers.length === 0) {
        console.log(`Config ${config.id} has no notification numbers, skipping`);
        continue;
      }

      // Render the message using the template
      const message = renderTemplate(
        config.message_template,
        payload,
        config.osticket_url
      );

      console.log(`Sending to ${config.notification_numbers.length} numbers for config ${config.id}`);

      // Send WhatsApp to each number and save to history
      for (const phone of config.notification_numbers) {
        // Add a small delay between messages to avoid rate limiting
        if (totalSent > 0 || totalFailed > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        const success = await sendWhatsAppMessage(phone, message);
        
        // Save ticket to history
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
            notification_sent: success,
            notification_phone: phone,
          });

        if (insertError) {
          console.error("Error saving ticket to history:", insertError);
        } else {
          console.log("📝 Ticket saved to history");
        }

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
        message: `Notifications sent`,
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
