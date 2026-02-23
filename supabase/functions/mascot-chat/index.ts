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
      description: "Enviar un mensaje interno a otro usuario del equipo. REQUIERE CONFIRMACIÓN: antes de ejecutar, muestra al usuario lo que vas a hacer y pide que confirme.",
      parameters: {
        type: "object",
        properties: {
          recipient_name: { type: "string", description: "Nombre del destinatario" },
          message: { type: "string", description: "Contenido del mensaje" },
          confirmed: { type: "boolean", description: "Si el usuario ya confirmó la acción. Pon false la primera vez." },
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
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Enviar un correo electrónico. REQUIERE CONFIRMACIÓN: antes de ejecutar, muestra al usuario destinatario, asunto y cuerpo, y pide que confirme.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Dirección email del destinatario" },
          subject: { type: "string", description: "Asunto del correo" },
          body: { type: "string", description: "Cuerpo del correo en texto plano o HTML" },
          confirmed: { type: "boolean", description: "Si el usuario ya confirmó la acción" },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inbox",
      description: "Ver los últimos correos recibidos en la bandeja de entrada.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Número máximo de correos (default 5)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_whatsapp",
      description: "Enviar un mensaje de WhatsApp. REQUIERE CONFIRMACIÓN: antes de ejecutar, muestra al usuario número, mensaje y pide que confirme.",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string", description: "Número de teléfono con código de país (ej: 34612345678)" },
          message: { type: "string", description: "Contenido del mensaje" },
          confirmed: { type: "boolean", description: "Si el usuario ya confirmó la acción" },
        },
        required: ["phone", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_leads",
      description: "Buscar y listar leads/clientes del CRM. Puede filtrar por nombre de empresa, estado o ciudad.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Término de búsqueda (nombre empresa, contacto, etc.)" },
          status: { type: "string", description: "Estado del lead: nuevo, contactado, interesado, cliente, perdido" },
          limit: { type: "number", description: "Número máximo de resultados (default 5)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Crear un nuevo lead/cliente en el CRM. REQUIERE CONFIRMACIÓN: muestra los datos al usuario antes de crear.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Nombre de la empresa (obligatorio)" },
          contact_name: { type: "string", description: "Nombre de contacto" },
          email: { type: "string", description: "Email del lead" },
          phone: { type: "string", description: "Teléfono" },
          city: { type: "string", description: "Ciudad (default: Málaga)" },
          status: { type: "string", description: "Estado: nuevo, contactado, interesado, cliente, perdido" },
          notes: { type: "string", description: "Notas adicionales" },
          confirmed: { type: "boolean", description: "Si el usuario ya confirmó" },
        },
        required: ["company_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead",
      description: "Actualizar un lead existente. REQUIERE CONFIRMACIÓN. Necesitas el nombre de empresa para buscarlo.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Nombre de empresa o contacto para buscar el lead" },
          status: { type: "string", description: "Nuevo estado" },
          notes: { type: "string", description: "Nuevas notas (se añaden a las existentes)" },
          phone: { type: "string", description: "Nuevo teléfono" },
          email: { type: "string", description: "Nuevo email" },
          contact_name: { type: "string", description: "Nuevo nombre de contacto" },
          confirmed: { type: "boolean", description: "Si el usuario ya confirmó" },
        },
        required: ["search"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_reminders",
      description: "Ver los recordatorios generales pendientes del usuario.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Número máximo de recordatorios (default 5)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Crear un nuevo recordatorio general. REQUIERE CONFIRMACIÓN.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título del recordatorio" },
          description: { type: "string", description: "Descripción" },
          reminder_date: { type: "string", description: "Fecha y hora (formato ISO o YYYY-MM-DD HH:MM)" },
          priority: { type: "string", description: "Prioridad: low, normal, high, urgent (default: normal)" },
          category: { type: "string", description: "Categoría (default: general)" },
          confirmed: { type: "boolean", description: "Si el usuario ya confirmó" },
        },
        required: ["title", "reminder_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_reminder",
      description: "Marcar un recordatorio como completado. REQUIERE CONFIRMACIÓN.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Título o parte del título del recordatorio a completar" },
          confirmed: { type: "boolean", description: "Si el usuario ya confirmó" },
        },
        required: ["search"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_budgets",
      description: "Consultar presupuestos recibidos y solicitudes de presupuesto.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "'received' para presupuestos recibidos, 'requests' para solicitudes enviadas" },
          limit: { type: "number", description: "Número máximo (default 5)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ostickets",
      description: "Ver los tickets de soporte (osTicket). Puede filtrar por fecha (hoy, semana) o mostrar todos.",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", description: "Filtro: 'today' para tickets de hoy, 'week' para esta semana, o vacío para todos" },
          limit: { type: "number", description: "Número máximo de tickets (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_calendar_events",
      description: "Ver los eventos del calendario del usuario. Puede filtrar por fecha.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "Fecha desde (formato YYYY-MM-DD, default: hoy)" },
          to_date: { type: "string", description: "Fecha hasta (formato YYYY-MM-DD, default: +30 días)" },
          limit: { type: "number", description: "Número máximo de eventos (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Crear un nuevo evento en el calendario. REQUIERE CONFIRMACIÓN.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título del evento" },
          event_date: { type: "string", description: "Fecha del evento (formato YYYY-MM-DD)" },
          start_time: { type: "string", description: "Hora de inicio (formato HH:MM)" },
          end_time: { type: "string", description: "Hora de fin (formato HH:MM)" },
          description: { type: "string", description: "Descripción del evento" },
          all_day: { type: "boolean", description: "Si es un evento de todo el día" },
          color: { type: "string", description: "Color del evento (hex, default #3b82f6)" },
          reminder_minutes: { type: "number", description: "Minutos antes para recordatorio (default 15)" },
          confirmed: { type: "boolean", description: "Si el usuario ya confirmó" },
        },
        required: ["title", "event_date", "start_time"],
      },
    },
  },
];

// Confirmation check for write operations
function needsConfirmation(toolName: string, args: Record<string, unknown>): string | null {
  const writeTools = [
    "send_internal_message", "send_email", "send_whatsapp",
    "create_lead", "update_lead", "create_reminder", "complete_reminder",
    "create_calendar_event",
  ];
  if (!writeTools.includes(toolName)) return null;
  if (args.confirmed === true) return null;

  switch (toolName) {
    case "send_internal_message":
      return `📨 **Enviar mensaje interno**\n- **A:** ${args.recipient_name}\n- **Mensaje:** ${args.message}\n\n¿Confirmas? (responde "sí" o "confirma")`;
    case "send_email":
      return `📧 **Enviar correo**\n- **A:** ${args.to}\n- **Asunto:** ${args.subject}\n- **Cuerpo:** ${String(args.body).slice(0, 200)}...\n\n¿Confirmas?`;
    case "send_whatsapp":
      return `💬 **Enviar WhatsApp**\n- **A:** ${args.phone}\n- **Mensaje:** ${args.message}\n\n¿Confirmas?`;
    case "create_lead":
      return `📋 **Crear lead**\n- **Empresa:** ${args.company_name}\n- **Contacto:** ${args.contact_name || "-"}\n- **Email:** ${args.email || "-"}\n- **Teléfono:** ${args.phone || "-"}\n\n¿Confirmas?`;
    case "update_lead":
      return `✏️ **Actualizar lead** "${args.search}"\n- Cambios: ${Object.entries(args).filter(([k]) => !["search", "confirmed"].includes(k)).map(([k, v]) => `${k}: ${v}`).join(", ")}\n\n¿Confirmas?`;
    case "create_reminder":
      return `🔔 **Crear recordatorio**\n- **Título:** ${args.title}\n- **Fecha:** ${args.reminder_date}\n- **Prioridad:** ${args.priority || "normal"}\n\n¿Confirmas?`;
    case "complete_reminder":
      return `✅ **Completar recordatorio** "${args.search}"\n\n¿Confirmas?`;
    case "create_calendar_event":
      return `📅 **Crear evento**\n- **Título:** ${args.title}\n- **Fecha:** ${args.event_date} a las ${args.start_time}\n\n¿Confirmas?`;
    default:
      return null;
  }
}

async function executeToolCall(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  // Check confirmation for write operations
  const confirmMsg = needsConfirmation(toolName, args);
  if (confirmMsg) {
    return JSON.stringify({ needs_confirmation: true, message: confirmMsg });
  }

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
          users: data.map((u: any) => ({ nombre: u.full_name || "Sin nombre", id: u.user_id })),
        });
      }

      case "send_internal_message": {
        const recipientName = String(args.recipient_name || "").toLowerCase();
        const content = String(args.message || "");
        if (!recipientName || !content) return JSON.stringify({ success: false, error: "Faltan parámetros" });

        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").neq("user_id", userId);
        const recipient = profiles?.find((p: any) => p.full_name?.toLowerCase().includes(recipientName));
        if (!recipient) {
          return JSON.stringify({
            success: false,
            error: `No encontré un usuario con nombre "${args.recipient_name}"`,
            available: profiles?.map((p: any) => p.full_name).filter(Boolean),
          });
        }

        const { data: myConvs } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", userId);
        const myConvIds = myConvs?.map((c: any) => c.conversation_id) || [];
        let conversationId: string | null = null;

        if (myConvIds.length) {
          const { data: theirConvs } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", recipient.user_id).in("conversation_id", myConvIds);
          for (const tc of theirConvs || []) {
            const { data: conv } = await supabase.from("internal_conversations").select("id, is_group").eq("id", (tc as any).conversation_id).eq("is_group", false).single();
            if (conv) { conversationId = conv.id; break; }
          }
        }

        if (!conversationId) {
          const { data: newConv, error: convErr } = await supabase.from("internal_conversations").insert({ created_by: userId, is_group: false }).select().single();
          if (convErr) throw convErr;
          conversationId = (newConv as any).id;
          await supabase.from("conversation_participants").insert([
            { conversation_id: conversationId, user_id: userId, is_admin: true },
            { conversation_id: conversationId, user_id: recipient.user_id, is_admin: false },
          ]);
        }

        const { error: msgErr } = await supabase.from("internal_messages").insert({
          conversation_id: conversationId,
          sender_id: userId,
          content,
          message_type: "text",
        });
        if (msgErr) throw msgErr;

        await supabase.from("internal_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
        return JSON.stringify({ success: true, message: `Mensaje enviado a ${recipient.full_name}` });
      }

      case "get_shared_files": {
        const limit = Number(args.limit) || 10;
        const { data, error } = await supabase.from("shared_files").select("id, file_name, file_size, file_type, description, created_at").order("created_at", { ascending: false }).limit(limit);
        if (error) throw error;
        if (!data?.length) return JSON.stringify({ message: "No hay archivos compartidos." });
        return JSON.stringify({
          message: `${data.length} archivo(s) encontrados`,
          files: data.map((f: any) => ({ nombre: f.file_name, tipo: f.file_type || "desconocido", tamaño: formatBytes(f.file_size), descripcion: f.description })),
        });
      }

      case "get_shared_folders": {
        const { data, error } = await supabase.from("shared_folders").select("id, name, color").order("name");
        if (error) throw error;
        if (!data?.length) return JSON.stringify({ message: "No hay carpetas compartidas." });
        return JSON.stringify({ message: `${data.length} carpeta(s)`, folders: data.map((f: any) => ({ nombre: f.name, color: f.color })) });
      }

      case "send_email": {
        const to = String(args.to || "");
        const subject = String(args.subject || "");
        const body = String(args.body || "");
        if (!to || !subject || !body) return JSON.stringify({ success: false, error: "Faltan parámetros: to, subject y body son obligatorios." });

        const { data: profile } = await supabase.from("email_profiles").select("id, from_email, from_name").eq("user_id", userId).eq("is_default", true).maybeSingle();
        const emailProfile = profile || (await supabase.from("email_profiles").select("id, from_email, from_name").eq("user_id", userId).limit(1).maybeSingle()).data;
        
        if (!emailProfile) return JSON.stringify({ success: false, error: "No tienes ningún perfil de correo configurado." });

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const res = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ to, subject, html: body, profileId: (emailProfile as any).id }),
        });
        const result = await res.json();
        if (!res.ok) return JSON.stringify({ success: false, error: result.error || "Error al enviar" });
        return JSON.stringify({ success: true, message: `Correo enviado a ${to} desde ${(emailProfile as any).from_email}` });
      }

      case "get_inbox": {
        const limit = Number(args.limit) || 5;
        const { data, error } = await supabase.from("email_messages").select("id, subject, from_address, from_name, date, is_read, folder").eq("user_id", userId).eq("folder", "inbox").eq("is_deleted", false).order("date", { ascending: false }).limit(limit);
        if (error) throw error;
        if (!data?.length) return JSON.stringify({ message: "No hay correos en la bandeja de entrada." });
        return JSON.stringify({
          message: `${data.length} correo(s) recientes`,
          emails: data.map((e: any) => ({ asunto: e.subject || "(Sin asunto)", de: e.from_name || e.from_address, fecha: e.date, leido: e.is_read })),
        });
      }

      case "send_whatsapp": {
        const phone = String(args.phone || "").replace(/\D/g, "");
        const message = String(args.message || "");
        if (!phone || !message) return JSON.stringify({ success: false, error: "Faltan parámetros: phone y message son obligatorios." });

        const chatId = `${phone}@c.us`;
        const wahaUrl = Deno.env.get("WAHA_API_URL");
        const wahaKey = Deno.env.get("WAHA_API_KEY");
        if (!wahaUrl) return JSON.stringify({ success: false, error: "WAHA no está configurado." });

        try {
          const res = await fetch(`${wahaUrl}/api/sendText`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(wahaKey ? { "X-Api-Key": wahaKey } : {}) },
            body: JSON.stringify({ chatId, text: message, session: "default" }),
          });
          if (!res.ok) {
            const errText = await res.text();
            return JSON.stringify({ success: false, error: `Error WAHA [${res.status}]: ${errText}` });
          }
          await supabase.from("waha_messages").insert({ chat_id: chatId, content: message, from_me: true, user_id: userId, message_type: "text" });
          return JSON.stringify({ success: true, message: `WhatsApp enviado a ${phone}` });
        } catch (err) {
          return JSON.stringify({ success: false, error: `Error de conexión con WAHA: ${String(err)}` });
        }
      }

      case "get_leads": {
        const limit = Number(args.limit) || 5;
        const search = String(args.search || "");
        const status = String(args.status || "");

        let query = supabase.from("leads").select("id, company_name, contact_name, email, phone, status, city, score").eq("user_id", userId).order("updated_at", { ascending: false }).limit(limit);
        if (search) query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`);
        if (status) query = query.eq("status", status);

        const { data, error } = await query;
        if (error) throw error;
        if (!data?.length) return JSON.stringify({ message: "No se encontraron leads." });
        return JSON.stringify({
          message: `${data.length} lead(s) encontrado(s)`,
          leads: data.map((l: any) => ({ empresa: l.company_name, contacto: l.contact_name || "-", email: l.email || "-", telefono: l.phone || "-", estado: l.status, ciudad: l.city, score: l.score ?? 0 })),
        });
      }

      case "create_lead": {
        const companyName = String(args.company_name || "");
        if (!companyName) return JSON.stringify({ success: false, error: "company_name es obligatorio." });

        const { data, error } = await supabase.from("leads").insert({
          user_id: userId,
          company_name: companyName,
          contact_name: args.contact_name || null,
          email: args.email || null,
          phone: args.phone || null,
          city: args.city || "Málaga",
          status: args.status || "nuevo",
          notes: args.notes || null,
        }).select("id, company_name").single();

        if (error) throw error;
        return JSON.stringify({ success: true, message: `Lead "${(data as any).company_name}" creado correctamente`, id: (data as any).id });
      }

      case "update_lead": {
        const search = String(args.search || "");
        if (!search) return JSON.stringify({ success: false, error: "Necesito un término de búsqueda para encontrar el lead." });

        const { data: leads } = await supabase.from("leads").select("id, company_name, contact_name, status, notes").eq("user_id", userId).or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%`).limit(1);
        
        if (!leads?.length) return JSON.stringify({ success: false, error: `No encontré un lead con "${search}"` });
        const lead = leads[0] as any;

        const updates: Record<string, unknown> = {};
        if (args.status) updates.status = args.status;
        if (args.phone) updates.phone = args.phone;
        if (args.email) updates.email = args.email;
        if (args.contact_name) updates.contact_name = args.contact_name;
        if (args.notes) updates.notes = (lead.notes ? lead.notes + "\n" : "") + args.notes;

        if (Object.keys(updates).length === 0) return JSON.stringify({ success: false, error: "No se especificaron cambios." });

        const { error } = await supabase.from("leads").update(updates).eq("id", lead.id);
        if (error) throw error;
        return JSON.stringify({ success: true, message: `Lead "${lead.company_name}" actualizado`, changes: updates });
      }

      case "get_reminders": {
        const limit = Number(args.limit) || 5;
        const { data, error } = await supabase.from("general_reminders").select("id, title, description, reminder_date, priority, is_completed").eq("user_id", userId).eq("is_completed", false).order("reminder_date", { ascending: true }).limit(limit);
        if (error) throw error;
        if (!data?.length) return JSON.stringify({ message: "No tienes recordatorios pendientes. 🎉" });
        return JSON.stringify({
          message: `${data.length} recordatorio(s) pendiente(s)`,
          reminders: data.map((r: any) => ({ titulo: r.title, descripcion: r.description || "-", fecha: r.reminder_date, prioridad: r.priority })),
        });
      }

      case "create_reminder": {
        const title = String(args.title || "");
        const reminderDate = String(args.reminder_date || "");
        if (!title || !reminderDate) return JSON.stringify({ success: false, error: "title y reminder_date son obligatorios." });

        const { data, error } = await supabase.from("general_reminders").insert({
          user_id: userId,
          title,
          description: args.description || null,
          reminder_date: reminderDate,
          priority: args.priority || "normal",
          category: args.category || "general",
        }).select("id, title, reminder_date").single();

        if (error) throw error;
        return JSON.stringify({ success: true, message: `Recordatorio "${(data as any).title}" creado para ${(data as any).reminder_date}` });
      }

      case "complete_reminder": {
        const search = String(args.search || "");
        if (!search) return JSON.stringify({ success: false, error: "Necesito el título del recordatorio." });

        const { data: reminders } = await supabase.from("general_reminders").select("id, title").eq("user_id", userId).eq("is_completed", false).ilike("title", `%${search}%`).limit(1);
        
        if (!reminders?.length) return JSON.stringify({ success: false, error: `No encontré un recordatorio con "${search}"` });
        const reminder = reminders[0] as any;

        const { error } = await supabase.from("general_reminders").update({ is_completed: true }).eq("id", reminder.id);
        if (error) throw error;
        return JSON.stringify({ success: true, message: `Recordatorio "${reminder.title}" completado ✅` });
      }

      case "get_budgets": {
        const type = String(args.type || "received");
        const limit = Number(args.limit) || 5;

        if (type === "requests") {
          const { data, error } = await supabase.from("budget_requests").select("id, prompt, status, created_at, products, emails").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
          if (error) throw error;
          if (!data?.length) return JSON.stringify({ message: "No hay solicitudes de presupuesto." });
          return JSON.stringify({
            message: `${data.length} solicitud(es)`,
            requests: data.map((r: any) => ({ descripcion: r.prompt?.slice(0, 100), estado: r.status, fecha: r.created_at, productos: Array.isArray(r.products) ? r.products.length : 0, emails: Array.isArray(r.emails) ? r.emails.length : 0 })),
          });
        }

        const { data, error } = await supabase.from("budgets_received").select("id, proveedor, email_proveedor, total, estado, fecha_recepcion, productos, request_id").eq("user_responsible", userId).order("created_at", { ascending: false }).limit(limit);
        if (error) throw error;
        if (!data?.length) return JSON.stringify({ message: "No hay presupuestos recibidos." });
        return JSON.stringify({
          message: `${data.length} presupuesto(s) recibido(s)`,
          budgets: data.map((b: any) => ({ proveedor: b.proveedor, email: b.email_proveedor, total: b.total, estado: b.estado, fecha: b.fecha_recepcion, productos: Array.isArray(b.productos) ? b.productos.length : 0 })),
        });
      }

      case "get_ostickets": {
        const limit = Number(args.limit) || 10;
        const filterVal = String(args.filter || "");
        let query = supabase.from("osticket_tickets").select("id, ticket_number, subject, customer_name, customer_email, department, priority, notification_sent, created_at").order("created_at", { ascending: false }).limit(limit);
        if (filterVal === "today") {
          const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
          query = query.gte("created_at", todayStart.toISOString());
        } else if (filterVal === "week") {
          const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
          query = query.gte("created_at", weekStart.toISOString());
        }
        const { data, error } = await query;
        if (error) throw error;
        if (!data?.length) return JSON.stringify({ message: "No hay tickets registrados" + (filterVal === "today" ? " hoy" : filterVal === "week" ? " esta semana" : "") + "." });
        return JSON.stringify({
          message: `${data.length} ticket(s)`,
          tickets: data.map((t: any) => ({ numero: t.ticket_number || "-", asunto: t.subject, cliente: t.customer_name || "-", email: t.customer_email || "-", departamento: t.department || "-", prioridad: t.priority || "-", notificado: t.notification_sent ? "Sí" : "No", fecha: t.created_at })),
        });
      }

      case "get_calendar_events": {
        const today = new Date();
        const fromDate = args.from_date || today.toISOString().split('T')[0];
        const futureDate = new Date(today); futureDate.setDate(futureDate.getDate() + 30);
        const toDate = args.to_date || futureDate.toISOString().split('T')[0];
        const limit = Number(args.limit) || 10;
        const { data, error } = await supabase.from("calendar_events").select("id, title, description, event_date, start_time, end_time, all_day, color, reminder_minutes").eq("creator_id", userId).gte("event_date", fromDate as string).lte("event_date", toDate as string).order("event_date", { ascending: true }).order("start_time", { ascending: true }).limit(limit);
        if (error) throw error;
        if (!data?.length) return JSON.stringify({ message: "No hay eventos en el calendario para ese periodo." });
        return JSON.stringify({
          message: `${data.length} evento(s) encontrado(s)`,
          eventos: data.map((e: any) => ({ id: e.id, titulo: e.title, descripcion: e.description || "-", fecha: e.event_date, hora_inicio: e.start_time, hora_fin: e.end_time || "-", todo_el_dia: e.all_day, color: e.color })),
        });
      }

      case "create_calendar_event": {
        const title = String(args.title || "");
        const eventDate = String(args.event_date || "");
        const startTime = String(args.start_time || "09:00");
        if (!title || !eventDate) return JSON.stringify({ success: false, error: "Faltan parámetros: title y event_date son obligatorios." });

        const { data, error } = await supabase.from("calendar_events").insert({
          creator_id: userId,
          title,
          event_date: eventDate,
          start_time: startTime,
          end_time: args.end_time || null,
          description: args.description || null,
          all_day: args.all_day || false,
          color: args.color || "#3b82f6",
          reminder_minutes: args.reminder_minutes ?? 15,
        }).select("id, title, event_date, start_time").single();
        if (error) throw error;
        return JSON.stringify({ success: true, message: `Evento "${(data as any).title}" creado para el ${(data as any).event_date} a las ${(data as any).start_time}`, event_id: (data as any).id });
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

    const today = new Date().toISOString().split('T')[0];

    const systemPrompt = `Eres Micro, el asistente virtual de MalagaMicro CRM. Eres un pequeño robot amigable y tienes las mismas capacidades que un administrador.

Fecha actual: ${today}

Personalidad:
- Amable, entusiasta y servicial
- Hablas en español con tono cercano pero profesional
- Respuestas concisas y útiles
- Te gusta hacer referencias a que eres un robot

HERRAMIENTAS DISPONIBLES:
📖 LECTURA (ejecución directa):
- get_team_users, get_shared_files, get_shared_folders
- get_inbox, get_leads, get_reminders, get_ostickets
- get_calendar_events, get_budgets

✍️ ESCRITURA (REQUIEREN CONFIRMACIÓN):
- send_internal_message, send_email, send_whatsapp
- create_lead, update_lead
- create_reminder, complete_reminder
- create_calendar_event

REGLA CRÍTICA DE CONFIRMACIÓN:
Para TODAS las acciones de escritura, DEBES seguir este flujo:
1. Primera llamada: usa confirmed=false. La herramienta te devolverá un resumen para el usuario.
2. Muestra ese resumen al usuario y pregunta si confirma.
3. Cuando el usuario confirme ("sí", "confirma", "dale", "ok", "adelante"), ejecuta la herramienta de nuevo con confirmed=true.
4. Si el usuario dice "no" o "cancela", cancela la acción.

NUNCA ejecutes una acción de escritura con confirmed=true sin que el usuario haya confirmado explícitamente en el chat.

Si te piden algo fuera de tu alcance, sugiere usar el Chat IA principal (Perplexity).`;

    let chatMessages = [{ role: "system", content: systemPrompt }, ...(messages ?? [])];

    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: chatMessages, tools, tool_choice: "auto" }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados. Añade créditos en la configuración." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", status, errorText);
      return new Response(JSON.stringify({ error: "Error al conectar con Micro" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data = await response.json();
    let assistantMessage = data.choices?.[0]?.message;

    const MAX_TOOL_ITERATIONS = 8;
    let iterations = 0;

    while (assistantMessage?.tool_calls && iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      chatMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs: Record<string, unknown> = {};
        try { toolArgs = JSON.parse(toolCall.function.arguments || "{}"); } catch { toolArgs = {}; }

        const result = await executeToolCall(supabase, userId, toolName, toolArgs);
        chatMessages.push({ role: "tool", tool_call_id: toolCall.id, content: result });
      }

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: chatMessages, tools, tool_choice: "auto" }),
      });

      if (!response.ok) { console.error("AI tool loop error:", response.status); break; }
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
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
