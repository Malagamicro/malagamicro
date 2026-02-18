import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Evolution API webhook event types
type EvolutionEvent =
  | 'messages.upsert'
  | 'messages.update'
  | 'messages.delete'
  | 'send.message'
  | 'connection.update'
  | 'qrcode.updated'
  | 'messages.set';

interface EvolutionMessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
  participant?: string;
}

interface EvolutionMessage {
  key: EvolutionMessageKey;
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string; url?: string; mimetype?: string };
    videoMessage?: { caption?: string; url?: string };
    audioMessage?: { url?: string };
    documentMessage?: { title?: string; url?: string };
    stickerMessage?: { url?: string };
    reactionMessage?: { text?: string; key?: EvolutionMessageKey };
    editedMessage?: { message?: { conversation?: string; extendedTextMessage?: { text?: string } }; key?: EvolutionMessageKey };
    protocolMessage?: { type?: number; key?: EvolutionMessageKey };
  };
  messageType?: string;
  messageTimestamp?: number;
  status?: number; // 0=ERROR, 1=PENDING, 2=SERVER_ACK, 3=DELIVERY_ACK, 4=READ, 5=PLAYED
  mediaUrl?: string;
}

interface EvolutionWebhook {
  event: EvolutionEvent;
  instance: string;
  data: EvolutionMessage | EvolutionMessage[] | any;
  destination?: string;
  date_time?: string;
  server_url?: string;
  apikey?: string;
}

// Map Evolution status codes to human-readable
const statusMap: Record<number, string> = {
  0: 'error',
  1: 'pending',
  2: 'sent',
  3: 'delivered',
  4: 'read',
  5: 'played',
};

// Extract text content from Evolution message object
function extractTextContent(msg: EvolutionMessage): string {
  if (!msg.message) return '';
  const m = msg.message;
  return m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.videoMessage?.caption
    || m.documentMessage?.title
    || '';
}

// Determine message type
function getMessageType(msg: EvolutionMessage): string {
  if (!msg.message) return msg.messageType || 'text';
  const m = msg.message;
  if (m.imageMessage) return 'image';
  if (m.videoMessage) return 'video';
  if (m.audioMessage) return 'audio';
  if (m.documentMessage) return 'document';
  if (m.stickerMessage) return 'sticker';
  if (m.reactionMessage) return 'reaction';
  if (m.protocolMessage) return 'protocol';
  return 'text';
}

// Extract phone number from remoteJid
function extractPhone(remoteJid: string): string {
  return remoteJid.replace(/@(s\.whatsapp\.net|g\.us|c\.us)$/, '');
}

Deno.serve(async (req) => {
  console.log("=== Evolution API Webhook received ===");
  console.log("Method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate webhook request
  const webhookSecret = Deno.env.get("WAHA_WEBHOOK_SECRET");
  const providedKey = req.headers.get("x-api-key") ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    new URL(req.url).searchParams.get("api_key");

  if (webhookSecret && webhookSecret !== providedKey) {
    console.error("Unauthorized webhook request");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await req.text();
    console.log("Raw body (first 500):", rawBody.substring(0, 500));

    let body: EvolutionWebhook;
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
    console.log("Instance:", body.instance);

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

    switch (body.event) {
      case 'connection.update':
        console.log("📱 Connection update:", JSON.stringify(body.data));
        return new Response(JSON.stringify({ status: "ok", event: "connection.update" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      case 'qrcode.updated':
        console.log("📲 QR code updated");
        return new Response(JSON.stringify({ status: "ok", event: "qrcode.updated" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      case 'messages.upsert':
        return await handleMessagesUpsert(supabase, body);

      case 'messages.update':
        return await handleMessagesUpdate(supabase, body);

      case 'messages.delete':
        return await handleMessagesDelete(supabase, body);

      case 'send.message':
        // Outgoing messages sent through the API
        return await handleSendMessage(supabase, body);

      case 'messages.set':
        console.log("📋 Messages set (initial load)");
        return new Response(JSON.stringify({ status: "ok", event: "messages.set" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      default:
        console.log("Unknown event type:", body.event);
        return new Response(JSON.stringify({ status: "ignored", event: body.event }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper to get or create a chat entry
async function getOrCreateChat(
  supabase: any,
  userId: string,
  chatId: string,
  phoneNumber: string
) {
  const { data: existingChat } = await supabase
    .from("whatsapp_chats")
    .select("id")
    .eq("user_id", userId)
    .eq("chat_id", chatId)
    .single();

  if (existingChat) {
    await supabase
      .from("whatsapp_chats")
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingChat.id);
    return existingChat;
  }

  const { data: newChat, error } = await supabase
    .from("whatsapp_chats")
    .insert({
      user_id: userId,
      chat_id: chatId,
      phone: phoneNumber,
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating chat:", error);
  }

  console.log("📱 New chat created:", chatId);
  return newChat;
}

// Helper to increment unread count
async function incrementUnreadCount(supabase: any, userId: string, chatId: string) {
  const { data: chat } = await supabase
    .from("whatsapp_chats")
    .select("unread_count")
    .eq("user_id", userId)
    .eq("chat_id", chatId)
    .single();

  if (chat) {
    await supabase
      .from("whatsapp_chats")
      .update({
        unread_count: (chat.unread_count || 0) + 1,
        last_message_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("chat_id", chatId);
  }
}

// Find user to assign message to
async function findUserId(supabase: any, phoneNumber: string): Promise<{ userId: string | null; leadId: string | null }> {
  // Try to find a lead with matching phone
  const { data: leads } = await supabase
    .from("leads")
    .select("id, user_id")
    .or(`phone.ilike.%${phoneNumber}%,phone.ilike.%${phoneNumber.slice(-9)}%`)
    .limit(1);

  const lead = leads?.[0];
  let userId = lead?.user_id;

  if (!userId) {
    const { data: profiles } = await supabase.from("profiles").select("user_id").limit(1);
    userId = profiles?.[0]?.user_id;
  }

  return { userId, leadId: lead?.id || null };
}

// Handle MESSAGES_UPSERT (new incoming/outgoing messages)
async function handleMessagesUpsert(supabase: any, body: EvolutionWebhook) {
  const messages = Array.isArray(body.data) ? body.data : [body.data];

  for (const msg of messages) {
    if (!msg?.key) {
      console.log("Skipping message without key");
      continue;
    }

    const key = msg.key as EvolutionMessageKey;
    const remoteJid = key.remoteJid;

    // Skip group messages
    if (remoteJid.endsWith('@g.us')) {
      console.log("Skipping group message:", remoteJid);
      continue;
    }

    // Skip protocol messages (like read receipts)
    if (getMessageType(msg) === 'protocol') {
      console.log("Skipping protocol message");
      continue;
    }

    const phoneNumber = extractPhone(remoteJid);
    const chatId = remoteJid;
    const content = extractTextContent(msg);
    const messageType = getMessageType(msg);

    // Handle reaction messages
    if (messageType === 'reaction') {
      const reactionMsg = msg.message?.reactionMessage;
      if (reactionMsg?.key?.id) {
        const { error } = await supabase
          .from("waha_messages")
          .update({ reaction: reactionMsg.text })
          .eq("message_id", reactionMsg.key.id);
        if (error) console.error("Error updating reaction:", error);
      }
      continue;
    }

    console.log("📨 New message:", { chatId, fromMe: key.fromMe, messageType, content: content.substring(0, 100) });

    const { userId, leadId } = await findUserId(supabase, phoneNumber);

    if (!userId) {
      console.log("No user to assign message to");
      continue;
    }

    await getOrCreateChat(supabase, userId, chatId, phoneNumber);

    if (!key.fromMe) {
      await incrementUnreadCount(supabase, userId, chatId);
    }

    const messageTimestamp = msg.messageTimestamp
      ? new Date(msg.messageTimestamp * 1000).toISOString()
      : new Date().toISOString();

    const insertData = {
      chat_id: chatId,
      content: content || (messageType !== 'text' ? `[${messageType}]` : ''),
      from_me: key.fromMe ?? false,
      timestamp: messageTimestamp,
      lead_id: leadId,
      user_id: userId,
      message_id: key.id || null,
      media_url: msg.mediaUrl || null,
      message_type: messageType,
      ack_status: msg.status !== undefined ? statusMap[msg.status] || 'unknown' : null,
    };

    const { error: insertError } = await supabase.from("waha_messages").insert(insertData);

    if (insertError) {
      console.error("Error inserting message:", insertError);
    } else {
      console.log("✅ Message inserted!");
    }
  }

  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handle MESSAGES_UPDATE (status updates like read, delivered)
async function handleMessagesUpdate(supabase: any, body: EvolutionWebhook) {
  const updates = Array.isArray(body.data) ? body.data : [body.data];

  for (const update of updates) {
    const messageId = update?.key?.id || update?.keyId;
    const status = update?.status !== undefined ? statusMap[update.status] || 'unknown' : null;

    console.log(`✓ Status update: ${messageId} -> ${status}`);

    if (!messageId || !status) continue;

    const { error } = await supabase
      .from("waha_messages")
      .update({ ack_status: status })
      .eq("message_id", messageId);

    if (error) {
      console.error("Error updating status:", error);
    }
  }

  return new Response(JSON.stringify({ status: "ok", event: "messages.update" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handle MESSAGES_DELETE
async function handleMessagesDelete(supabase: any, body: EvolutionWebhook) {
  const messageId = body.data?.key?.id || body.data?.id;

  console.log("🗑️ Message deleted:", messageId);

  if (!messageId) {
    return new Response(JSON.stringify({ status: "ok", warning: "no message id" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error } = await supabase
    .from("waha_messages")
    .update({ is_revoked: true, content: "🚫 Mensaje eliminado" })
    .eq("message_id", messageId);

  if (error) {
    console.error("Error marking message as deleted:", error);
  }

  return new Response(JSON.stringify({ status: "ok", event: "messages.delete" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handle SEND_MESSAGE (outgoing messages sent via API)
async function handleSendMessage(supabase: any, body: EvolutionWebhook) {
  console.log("📤 Outgoing message via API:", JSON.stringify(body.data).substring(0, 200));
  // These are messages we sent ourselves, usually already logged by the frontend
  return new Response(JSON.stringify({ status: "ok", event: "send.message" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
