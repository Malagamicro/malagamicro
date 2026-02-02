import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

// WAHA event types we handle
type WahaEventType = 
  | 'session.status'
  | 'message'
  | 'message.any'
  | 'message.reaction'
  | 'message.ack'
  | 'message.waiting'
  | 'message.ack.group'
  | 'message.revoked'
  | 'message.edited'
  | 'chat.archive';

interface WahaPayload {
  id: string;
  timestamp: number;
  from: string;
  to: string;
  fromMe: boolean;
  body: string;
  hasMedia: boolean;
  mediaUrl?: string;
  type?: string;
  ack?: number;
  reaction?: {
    text: string;
    messageId: string;
  };
  _data?: {
    id?: {
      id: string;
      _serialized: string;
    };
  };
}

interface WahaWebhook {
  event: WahaEventType;
  session: string;
  payload: WahaPayload;
  me?: {
    id: string;
    pushname: string;
  };
}

// Map WAHA ack codes to human-readable status
const ackStatusMap: Record<number, string> = {
  0: 'pending',
  1: 'sent',
  2: 'delivered',
  3: 'read',
  4: 'played',
};

Deno.serve(async (req) => {
  console.log("=== WAHA Webhook received ===");
  console.log("Method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate webhook request using API key
  const webhookApiKey = Deno.env.get("WAHA_WEBHOOK_SECRET");
  const providedApiKey = req.headers.get("x-api-key") || 
                         req.headers.get("authorization")?.replace("Bearer ", "") ||
                         new URL(req.url).searchParams.get("api_key");

  // If webhook secret is configured, require authentication
  if (webhookApiKey && webhookApiKey !== providedApiKey) {
    console.error("Unauthorized webhook request - invalid or missing API key");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
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
      case 'session.status':
        console.log("📱 Session status update:", body.payload);
        return new Response(JSON.stringify({ status: "ok", event: "session.status" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      case 'message':
      case 'message.any':
        return await handleNewMessage(supabase, body);

      case 'message.ack':
      case 'message.ack.group':
        return await handleMessageAck(supabase, body);

      case 'message.reaction':
        return await handleMessageReaction(supabase, body);

      case 'message.revoked':
        return await handleMessageRevoked(supabase, body);

      case 'message.edited':
        return await handleMessageEdited(supabase, body);

      case 'message.waiting':
        console.log("⏳ Message waiting:", body.payload);
        return new Response(JSON.stringify({ status: "ok", event: "message.waiting" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      case 'chat.archive':
        console.log("📦 Chat archived:", body.payload);
        return new Response(JSON.stringify({ status: "ok", event: "chat.archive" }), {
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
  // Check if chat exists
  const { data: existingChat } = await supabase
    .from("whatsapp_chats")
    .select("id")
    .eq("user_id", userId)
    .eq("chat_id", chatId)
    .single();

  if (existingChat) {
    // Update last message timestamp
    await supabase
      .from("whatsapp_chats")
      .update({ 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingChat.id);
    return existingChat;
  }

  // Create new chat
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

// Helper to increment unread count for incoming messages
async function incrementUnreadCount(supabase: any, userId: string, chatId: string) {
  // Get current count
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

// Handle new incoming/outgoing messages
async function handleNewMessage(supabase: any, body: WahaWebhook) {
  const payload = body.payload;
  if (!payload) {
    console.error("No payload in message");
    return new Response(JSON.stringify({ error: "No payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("📨 New message:", JSON.stringify(payload, null, 2));

  const chatId = payload.fromMe ? payload.to : payload.from;
  const phoneNumber = chatId.replace("@c.us", "").replace("@s.whatsapp.net", "");

  // Try to find a lead with matching phone number
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

  if (!userId) {
    return new Response(JSON.stringify({ status: "ok", warning: "no user to assign" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get or create the chat entry
  await getOrCreateChat(supabase, userId, chatId, phoneNumber);

  // Increment unread count for incoming messages
  if (!payload.fromMe) {
    await incrementUnreadCount(supabase, userId, chatId);
  }

  const messageTimestamp = payload.timestamp
    ? new Date(payload.timestamp * 1000).toISOString()
    : new Date().toISOString();

  const insertData = {
    chat_id: chatId,
    content: payload.body || "",
    from_me: payload.fromMe ?? false,
    timestamp: messageTimestamp,
    lead_id: lead?.id || null,
    user_id: userId,
    message_id: payload.id || null,
    media_url: payload.mediaUrl || null,
    message_type: payload.type || 'text',
    ack_status: payload.ack !== undefined ? ackStatusMap[payload.ack] || 'unknown' : null,
  };

  const { error: insertError } = await supabase.from("waha_messages").insert(insertData);

  if (insertError) {
    console.error("Error inserting message:", insertError);
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("✅ Message inserted!");
  return new Response(JSON.stringify({ status: "ok" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handle message acknowledgment
async function handleMessageAck(supabase: any, body: WahaWebhook) {
  const payload = body.payload;
  const messageId = payload.id || payload._data?.id?._serialized;
  const ackStatus = payload.ack !== undefined ? ackStatusMap[payload.ack] || 'unknown' : null;

  console.log(`✓ ACK update: ${messageId} -> ${ackStatus}`);

  if (!messageId) {
    return new Response(JSON.stringify({ status: "ok", warning: "no message id" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error } = await supabase
    .from("waha_messages")
    .update({ ack_status: ackStatus })
    .eq("message_id", messageId);

  if (error) {
    console.error("Error updating ack:", error);
  }

  return new Response(JSON.stringify({ status: "ok", event: "message.ack", ack: ackStatus }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handle message reactions
async function handleMessageReaction(supabase: any, body: WahaWebhook) {
  const payload = body.payload;
  const reactionData = payload.reaction;

  console.log("😀 Reaction:", reactionData);

  if (!reactionData?.messageId) {
    return new Response(JSON.stringify({ status: "ok", warning: "no reaction data" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error } = await supabase
    .from("waha_messages")
    .update({ reaction: reactionData.text })
    .eq("message_id", reactionData.messageId);

  if (error) {
    console.error("Error updating reaction:", error);
  }

  return new Response(JSON.stringify({ status: "ok", event: "message.reaction" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handle revoked messages
async function handleMessageRevoked(supabase: any, body: WahaWebhook) {
  const payload = body.payload;
  const messageId = payload.id || payload._data?.id?._serialized;

  console.log("🗑️ Message revoked:", messageId);

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
    console.error("Error marking message as revoked:", error);
  }

  return new Response(JSON.stringify({ status: "ok", event: "message.revoked" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Handle edited messages
async function handleMessageEdited(supabase: any, body: WahaWebhook) {
  const payload = body.payload;
  const messageId = payload.id || payload._data?.id?._serialized;
  const newContent = payload.body;

  console.log("✏️ Message edited:", messageId);

  if (!messageId) {
    return new Response(JSON.stringify({ status: "ok", warning: "no message id" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error } = await supabase
    .from("waha_messages")
    .update({ content: newContent, is_edited: true })
    .eq("message_id", messageId);

  if (error) {
    console.error("Error updating edited message:", error);
  }

  return new Response(JSON.stringify({ status: "ok", event: "message.edited" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}