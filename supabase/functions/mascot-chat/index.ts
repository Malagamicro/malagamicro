import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const tools = [
  {
    type: "function",
    function: {
      name: "get_team_users",
      description: "Obtener la lista de usuarios del equipo disponibles para mensajería interna.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "send_internal_message",
      description: "Enviar un mensaje interno a otro usuario del equipo.",
      parameters: {
        type: "object",
        properties: {
          recipient_name: { type: "string", description: "Nombre del destinatario" },
          message: { type: "string", description: "Contenido del mensaje" },
        },
        required: ["recipient_name", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_shared_files",
      description: "Ver los archivos compartidos disponibles en el sistema.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Número máximo de archivos (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_shared_folders",
      description: "Ver las carpetas compartidas disponibles.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

async function executeToolCall(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    switch (toolName) {
      case "get_team_users": {
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .neq("user_id", userId);

        if (error) throw error;

        if (!data?.length) return JSON.stringify({ message: "No hay otros usuarios en el sistema." });

        return JSON.stringify({
          message: `Hay ${data.length} usuario(s) en el equipo`,
          users: data.map((u) => ({ nombre: u.full_name || "Sin nombre", id: u.user_id })),
        });
      }

      case "send_internal_message": {
        const recipientName = String(args.recipient_name || "").toLowerCase();
        const content = String(args.message || "");

        if (!recipientName || !content) {
          return JSON.stringify({ success: false, error: "Faltan parámetros" });
        }

        // Find recipient
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").neq("user_id", userId);

        const recipient = profiles?.find((p) => p.full_name?.toLowerCase().includes(recipientName));

        if (!recipient) {
          return JSON.stringify({
            success: false,
            error: `No encontré un usuario con nombre "${args.recipient_name}"`,
            available: profiles?.map((p) => p.full_name).filter(Boolean),
          });
        }

        // Check or create conversation
        const { data: myConvs } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", userId);

        const myConvIds = myConvs?.map((c) => c.conversation_id) || [];

        let conversationId: string | null = null;

        if (myConvIds.length) {
          const { data: theirConvs } = await supabase
            .from("conversation_participants")
            .select("conversation_id")
            .eq("user_id", recipient.user_id)
            .in("conversation_id", myConvIds);

          // Find a 1:1 conversation
          for (const tc of theirConvs || []) {
            const { data: conv } = await supabase
              .from("internal_conversations")
              .select("id, is_group")
              .eq("id", tc.conversation_id)
              .eq("is_group", false)
              .single();

            if (conv) {
              conversationId = conv.id;
              break;
            }
          }
        }

        if (!conversationId) {
          // Create new conversation
          const { data: newConv, error: convErr } = await supabase
            .from("internal_conversations")
            .insert({ created_by: userId, is_group: false })
            .select()
            .single();

          if (convErr) throw convErr;

          conversationId = newConv.id;

          await supabase.from("conversation_participants").insert([
            { conversation_id: conversationId, user_id: userId, is_admin: true },
            { conversation_id: conversationId, user_id: recipient.user_id, is_admin: false },
          ]);
        }

        // Send message
        const { error: msgErr } = await supabase.from("internal_messages").insert({
          conversation_id: conversationId,
          sender_id: userId,
          content,
          message_type: "text",
        });

        if (msgErr) throw msgErr;

        await supabase
          .from("internal_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);

        return JSON.stringify({
          success: true,
          message: `Mensaje enviado a ${recipient.full_name}`,
        });
      }

      case "get_shared_files": {
        const limit = Number(args.limit) || 10;

        const { data, error } = await supabase
          .from("shared_files")
          .select("id, file_name, file_size, file_type, description, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;

        if (!data?.length) return JSON.stringify({ message: "No hay archivos compartidos." });

        return JSON.stringify({
          message: `${data.length} archivo(s) encontrados`,
          files: data.map((f) => ({
            nombre: f.file_name,
            tipo: f.file_type || "desconocido",
            tamaño: formatBytes(f.file_size),
            descripcion: f.description,
          })),
        });
      }

      case "get_shared_folders": {
        const { data, error } = await supabase.from("shared_folders").select("id, name, color").order("name");

        if (error) throw error;

        if (!data?.length) return JSON.stringify({ message: "No hay carpetas compartidas." });

        return JSON.stringify({
          message: `${data.length} carpeta(s)`,
          folders: data.map((f) => ({ nombre: f.name, color: f.color })),
        });
      }

      default:
        return JSON.stringify({ error: `Herramienta desconocida: ${toolName}` });
    }
  } catch (e) {
    console.error("Tool error:", e);
    return JSON.stringify({ error: String(e) });
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data } = await anonClient.auth.getUser(token);
      userId = data.user?.id ?? null;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Eres Micro, el asistente virtual de MalagaMicro CRM. Eres un pequeño robot amigable.

Personalidad:
- Amable, entusiasta y servicial
- Hablas en español con tono cercano pero profesional
- Respuestas concisas y útiles
- Te gusta hacer referencias a que eres un robot

Tienes acceso a herramientas para:
- Ver usuarios del equipo (get_team_users)
- Enviar mensajes internos (send_internal_message)
- Ver archivos compartidos (get_shared_files)
- Ver carpetas compartidas (get_shared_folders)

Si te piden algo que requiere estas herramientas, úsalas. Si te piden algo más avanzado (leads, emails, etc.), sugiere usar el Chat IA principal.`;

    let chatMessages = [{ role: "system", content: systemPrompt }, ...(messages ?? [])];

    // First call to Lovable AI Gateway
    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct",
        messages: chatMessages,
        tools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Error al conectar con Micro" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data = await response.json();
    let assistantMessage = data.choices?.[0]?.message;

    // Handle tool calls
    const MAX_TOOL_ITERATIONS = 5;
    let iterations = 0;

    while (assistantMessage?.tool_calls && iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      chatMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs = {};
        try {
          toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          toolArgs = {};
        }

        const result = await executeToolCall(supabase, userId, toolName, toolArgs);

        chatMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Call again with tool results
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: chatMessages,
          tools,
          tool_choice: "auto",
        }),
      });

      if (!response.ok) {
        console.error("OpenRouter tool loop error:", response.status);
        break;
      }

      data = await response.json();
      assistantMessage = data.choices?.[0]?.message;
    }

    const finalContent = assistantMessage?.content || "No tengo respuesta en este momento.";

    return new Response(JSON.stringify({ response: finalContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Mascot chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
