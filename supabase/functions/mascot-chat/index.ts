import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MICRO_EMAIL_PROFILE_ID = "845ff24b-a330-478b-a47f-d62c2fbab991";
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "https://evolutionapi.malagamicro.com").replace(/\/+$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE_NAME") || "CRM";

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
      description: "Crear un nuevo recordatorio general. REQUIERE CONFIRMACIÓN. Puede asignar a otros usuarios del equipo.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título del recordatorio" },
          description: { type: "string", description: "Descripción" },
          reminder_date: { type: "string", description: "Fecha y hora (formato ISO o YYYY-MM-DD HH:MM)" },
          priority: { type: "string", description: "Prioridad: low, normal, high, urgent (default: normal)" },
          category: { type: "string", description: "Categoría (default: general)" },
          target_users: {
            type: "array",
            description: "Nombres de usuarios a los que asignar el recordatorio. Usa get_team_users para obtener los nombres.",
            items: { type: "string" },
          },
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
      description: "Crear un nuevo evento en el calendario. REQUIERE CONFIRMACIÓN. Puede añadir participantes (usuarios del equipo).",
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
          participants: {
            type: "array",
            description: "Usuarios a invitar al evento. Usa get_team_users para obtener los nombres.",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Nombre del usuario a invitar" },
                permission: { type: "string", description: "'view' (solo ver) o 'edit' (puede editar). Default: 'view'" },
              },
              required: ["name"],
            },
          },
          confirmed: { type: "boolean", description: "Si el usuario ya confirmó" },
        },
        required: ["title", "event_date", "start_time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_calendar_event",
      description: "Eliminar un evento del calendario. REQUIERE CONFIRMACIÓN.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Título o parte del título del evento a eliminar" },
          confirmed: { type: "boolean", description: "Si el usuario ya confirmó" },
        },
        required: ["search"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sync_inbox_imap",
      description: "Sincronizar la bandeja de entrada IMAP para obtener los correos más recientes del servidor. Úsalo cuando el usuario pida actualizar o sincronizar su correo.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Número máximo de correos a sincronizar (default 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_email",
      description: "Leer el contenido completo de un correo electrónico específico por su asunto o remitente. Devuelve el cuerpo del correo y adjuntos.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Buscar por asunto, remitente o parte del contenido" },
          message_id: { type: "string", description: "ID específico del mensaje si se conoce" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_emails",
      description: "Buscar correos electrónicos por asunto, remitente, o contenido. Más potente que get_inbox.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Término de búsqueda (asunto, remitente, contenido)" },
          folder: { type: "string", description: "Carpeta: inbox, sent, drafts (default: inbox)" },
          limit: { type: "number", description: "Número máximo de resultados (default 10)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ai_memories",
      description: "Consultar los recuerdos/contexto almacenados sobre un lead o del usuario general. Úsalo al inicio de conversaciones para tener contexto.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID del lead para buscar recuerdos específicos (opcional)" },
          category: { type: "string", description: "Categoría: general, preference, interaction, note (opcional)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_ai_memory",
      description: "Guardar un recuerdo o dato relevante sobre un lead o el usuario para futuras conversaciones. Úsalo automáticamente cuando detectes información importante.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID del lead relacionado (opcional, null para recuerdos generales)" },
          memory_key: { type: "string", description: "Clave descriptiva del recuerdo (ej: 'preferencia_contacto', 'ultimo_acuerdo')" },
          memory_value: { type: "object", description: "Datos del recuerdo en formato JSON" },
          category: { type: "string", description: "Categoría: general, preference, interaction, note (default: general)" },
        },
        required: ["memory_key", "memory_value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_ai_memory",
      description: "Eliminar un recuerdo almacenado por su ID.",
      parameters: {
        type: "object",
        properties: {
          memory_id: { type: "string", description: "ID del recuerdo a eliminar" },
        },
        required: ["memory_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_apps_config",
      description: "Ver la configuración actual del hub de aplicaciones del usuario (categorías, apps, tamaño de iconos).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "update_apps_config",
      description: "Actualizar la configuración del hub de aplicaciones. REQUIERE CONFIRMACIÓN. Puede: crear/renombrar/eliminar categorías, cambiar iconos de apps y categorías, cambiar colores de categorías, cambiar tamaño de iconos (1=S, 2=M, 3=L, 4=XL), mover apps entre categorías, y ocultar/mostrar apps. Iconos disponibles: Home, Search, Settings, User, Users, Mail, MessageSquare, Phone, Video, Camera, Image, FileText, File, Folder, Globe, Cloud, Database, Lock, Shield, Bell, Clock, Calendar, Star, Heart, Bookmark, Flag, Tag, MapPin, Map, Sun, Moon, Zap, Cpu, Monitor, Smartphone, Music, Activity, Flame, Target, Award, Gift, ShoppingCart, CreditCard, DollarSign, Building, Truck, Package, Briefcase, BookOpen, Bot, Sparkles, Brain, Rocket, Megaphone, Ticket, MessagesSquare, FileEdit, Crown, Gem, etc.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", description: "Acción: 'add_category', 'rename_category', 'delete_category', 'set_category_icon', 'set_category_color', 'set_app_icon', 'set_icon_size', 'toggle_app_visibility', 'move_app'" },
          category_id: { type: "string", description: "ID de la categoría" },
          category_name: { type: "string", description: "Nombre para nueva categoría o renombrar" },
          icon: { type: "string", description: "Nombre del icono (PascalCase, ej: 'Rocket', 'Brain')" },
          color: { type: "string", description: "Color hex (ej: '#3b82f6')" },
          app_id: { type: "string", description: "ID de la app a modificar" },
          target_category_id: { type: "string", description: "Categoría destino para mover app" },
          icon_size: { type: "number", description: "Tamaño: 1(S), 2(M), 3(L), 4(XL)" },
          confirmed: { type: "boolean", description: "Si el usuario ya confirmó" },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_shared_file",
      description: "Ver/descargar un archivo compartido para analizar su contenido. Para imágenes devuelve la URL pública para que puedas describir la imagen. Para archivos de texto devuelve el contenido.",
      parameters: {
        type: "object",
        properties: {
          file_name: { type: "string", description: "Nombre (o parte) del archivo a buscar" },
          file_id: { type: "string", description: "ID del archivo si se conoce" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_ai_memory_file",
      description: "Leer el contenido de un archivo almacenado en la Memoria IA. Soporta TODOS los formatos: PDF, DOCX, Excel, imágenes, texto, CSV, etc. El texto de documentos binarios (PDF, DOCX, etc.) se extrae automáticamente al subirse. Busca por nombre de archivo o clave de memoria. Para imágenes devuelve la URL pública. Para documentos devuelve el contenido textual completo. Úsalo cuando el usuario pregunte por un archivo, imagen o documento guardado en la memoria IA.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Nombre del archivo o clave de memoria a buscar (ej: 'logo', 'manual', 'contrato')" },
          memory_id: { type: "string", description: "ID específico de la memoria si se conoce" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_notification",
      description: "Enviar una notificación personalizada (popup o silenciosa) a un usuario. Útil para alertas, avisos o información importante. REQUIERE CONFIRMACIÓN.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título de la notificación" },
          message: { type: "string", description: "Mensaje/cuerpo de la notificación" },
          type: { type: "string", enum: ["info", "success", "warning", "error", "ai"], description: "Tipo de notificación (default: ai)" },
          is_popup: { type: "boolean", description: "Si debe mostrarse como popup flotante (default: true)" },
          target_user: { type: "string", description: "Nombre del usuario destinatario (si no se especifica, se envía al usuario actual)" },
          confirmed: { type: "boolean", description: "Si el usuario ya confirmó" },
        },
        required: ["title", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_file",
      description: "Crear un archivo en el sistema de archivos compartidos con contenido. Soporta cualquier formato de texto: .md, .txt, .csv, .json, .html, .css, .js, .ts, .xml, .yaml, .sql, .log, etc. REQUIERE CONFIRMACIÓN.",
      parameters: {
        type: "object",
        properties: {
          file_name: { type: "string", description: "Nombre del archivo con extensión (ej: 'notas.md', 'datos.csv', 'config.json')" },
          content: { type: "string", description: "Contenido del archivo. Para Markdown usa sintaxis MD, para CSV usa comas, etc." },
          folder_name: { type: "string", description: "Nombre de la carpeta donde guardarlo (opcional, si no existe se crea)" },
          description: { type: "string", description: "Descripción del archivo (opcional)" },
          confirmed: { type: "boolean", description: "Si el usuario ya confirmó la acción" },
        },
        required: ["file_name", "content"],
      },
    },
  },
];
// Confirmation check for write operations
function needsConfirmation(toolName: string, args: Record<string, unknown>): string | null {
  const writeTools = [
    "send_internal_message", "send_email", "send_whatsapp",
    "create_lead", "update_lead", "create_reminder", "complete_reminder",
    "send_notification", "create_file",
    "create_calendar_event", "delete_calendar_event", "update_apps_config",
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
    case "create_reminder": {
      const targetUsers = Array.isArray(args.target_users) && args.target_users.length > 0
        ? `\n- **Asignado a:** ${(args.target_users as string[]).join(", ")}`
        : '';
      return `🔔 **Crear recordatorio**\n- **Título:** ${args.title}\n- **Fecha:** ${args.reminder_date}\n- **Prioridad:** ${args.priority || "normal"}${targetUsers}\n\n¿Confirmas?`;
    }
    case "complete_reminder":
      return `✅ **Completar recordatorio** "${args.search}"\n\n¿Confirmas?`;
    case "create_calendar_event": {
      const participants = Array.isArray(args.participants) && args.participants.length > 0
        ? `\n- **Participantes:** ${(args.participants as any[]).map((p: any) => `${p.name} (${p.permission || 'view'})`).join(", ")}`
        : '';
      return `📅 **Crear evento**\n- **Título:** ${args.title}\n- **Fecha:** ${args.event_date} a las ${args.start_time}${participants}\n\n¿Confirmas?`;
    }
    case "delete_calendar_event":
      return `🗑️ **Eliminar evento** "${args.search}"\n\n¿Confirmas?`;
    case "update_apps_config":
      return `🎨 **Modificar aplicaciones**\n- **Acción:** ${args.action}\n${args.category_name ? `- **Categoría:** ${args.category_name}\n` : ''}${args.icon ? `- **Icono:** ${args.icon}\n` : ''}${args.color ? `- **Color:** ${args.color}\n` : ''}${args.icon_size ? `- **Tamaño:** ${args.icon_size}\n` : ''}\n¿Confirmas?`;
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

        // Use Micro's dedicated email profile
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const res = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ to, subject, html: body, profileId: MICRO_EMAIL_PROFILE_ID }),
        });
        const result = await res.json();
        if (!res.ok) return JSON.stringify({ success: false, error: result.error || "Error al enviar" });
        return JSON.stringify({ success: true, message: `Correo enviado a ${to} desde ia@malagamicro.com (Fluiditos)` });
      }

      case "get_inbox": {
        const limit = Number(args.limit) || 5;
        // Get emails from Fluiditos' dedicated profile
        const { data: microProfile } = await supabase.from("email_profiles").select("user_id").eq("id", MICRO_EMAIL_PROFILE_ID).single();
        const microUserId = (microProfile as any)?.user_id || userId;
        const { data, error } = await supabase.from("email_messages").select("id, subject, from_address, from_name, date, is_read, folder, has_attachments").eq("profile_id", MICRO_EMAIL_PROFILE_ID).eq("folder", "inbox").eq("is_deleted", false).order("date", { ascending: false }).limit(limit);
        if (error) throw error;
        if (!data?.length) return JSON.stringify({ message: "No hay correos en la bandeja de entrada de Fluiditos." });
        return JSON.stringify({
          message: `${data.length} correo(s) recientes en el buzón de Fluiditos (ia@malagamicro.com)`,
          emails: data.map((e: any) => ({ id: e.id, asunto: e.subject || "(Sin asunto)", de: e.from_name || e.from_address, fecha: e.date, leido: e.is_read, adjuntos: e.has_attachments })),
        });
      }

      case "sync_inbox_imap": {
        const limit = Number(args.limit) || 20;
        // Sync Fluiditos' dedicated IMAP profile
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const res = await fetch(`${supabaseUrl}/functions/v1/imap-check`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ profile_id: MICRO_EMAIL_PROFILE_ID, action: "sync", limit }),
        });
        const result = await res.json();
        if (!res.ok) return JSON.stringify({ success: false, error: result.error || "Error al sincronizar" });
        return JSON.stringify({ success: true, message: `Sincronización del buzón de Fluiditos completada. ${result.new_messages ?? 0} correo(s) nuevo(s).`, total: result.total_messages ?? 0 });
      }

      case "read_email": {
        const messageId = String(args.message_id || "");
        const search = String(args.search || "");
        let msg: any = null;

        if (messageId) {
          const { data } = await supabase.from("email_messages").select("*").eq("id", messageId).eq("profile_id", MICRO_EMAIL_PROFILE_ID).single();
          msg = data;
        } else if (search) {
          const { data } = await supabase.from("email_messages").select("*").eq("profile_id", MICRO_EMAIL_PROFILE_ID).eq("is_deleted", false).or(`subject.ilike.%${search}%,from_address.ilike.%${search}%,from_name.ilike.%${search}%`).order("date", { ascending: false }).limit(1);
          msg = data?.[0];
        }
        if (!msg) return JSON.stringify({ error: "No se encontró el correo." });

        // If no body, try to fetch from IMAP using Fluiditos' profile
        if (!msg.body_html && !msg.body_text && msg.message_uid) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const res = await fetch(`${supabaseUrl}/functions/v1/imap-check`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ profile_id: MICRO_EMAIL_PROFILE_ID, action: "fetch-body", message_uid: msg.message_uid, message_id: msg.id }),
          });
          const result = await res.json();
          if (result.body_html || result.body_text) {
            msg.body_html = result.body_html;
            msg.body_text = result.body_text;
          }
        }

        // Get attachments
        const { data: attachments } = await supabase.from("email_attachments").select("file_name, file_type, file_size").eq("message_id", msg.id);

        // Strip HTML for readable text
        let bodyText = msg.body_text || "";
        if (!bodyText && msg.body_html) {
          bodyText = msg.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
        }

        return JSON.stringify({
          id: msg.id,
          asunto: msg.subject || "(Sin asunto)",
          de: msg.from_name ? `${msg.from_name} <${msg.from_address}>` : msg.from_address,
          para: msg.to_addresses,
          cc: msg.cc_addresses,
          fecha: msg.date,
          contenido: bodyText.slice(0, 3000),
          adjuntos: attachments?.map((a: any) => ({ nombre: a.file_name, tipo: a.file_type, tamaño: formatBytes(a.file_size) })) || [],
        });
      }

      case "search_emails": {
        const query = String(args.query || "");
        const folder = String(args.folder || "inbox");
        const limit = Number(args.limit) || 10;
        if (!query) return JSON.stringify({ error: "Necesito un término de búsqueda." });

        const { data, error } = await supabase.from("email_messages").select("id, subject, from_address, from_name, date, is_read, has_attachments, folder")
          .eq("profile_id", MICRO_EMAIL_PROFILE_ID).eq("is_deleted", false).eq("folder", folder)
          .or(`subject.ilike.%${query}%,from_address.ilike.%${query}%,from_name.ilike.%${query}%,body_text.ilike.%${query}%`)
          .order("date", { ascending: false }).limit(limit);
        if (error) throw error;
        if (!data?.length) return JSON.stringify({ message: `No se encontraron correos con "${query}" en ${folder}.` });
        return JSON.stringify({
          message: `${data.length} correo(s) encontrado(s)`,
          emails: data.map((e: any) => ({ id: e.id, asunto: e.subject || "(Sin asunto)", de: e.from_name || e.from_address, fecha: e.date, leido: e.is_read, adjuntos: e.has_attachments })),
        });
      }

      case "send_whatsapp": {
        const phone = String(args.phone || "").replace(/\D/g, "");
        const message = String(args.message || "");
        if (!phone || !message) return JSON.stringify({ success: false, error: "Faltan parámetros: phone y message son obligatorios." });

        // Use Evolution API instead of WAHA
        let cleanPhone = phone.replace(/^0+/, "");
        if (cleanPhone.length === 9) cleanPhone = "34" + cleanPhone;
        const chatId = `${cleanPhone}@s.whatsapp.net`;

        try {
          const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
            body: JSON.stringify({ number: cleanPhone, text: message }),
          });
          if (!res.ok) {
            const errText = await res.text();
            return JSON.stringify({ success: false, error: `Error Evolution API [${res.status}]: ${errText}` });
          }
          await supabase.from("waha_messages").insert({ chat_id: chatId, content: message, from_me: true, user_id: userId, message_type: "text" });
          return JSON.stringify({ success: true, message: `WhatsApp enviado a ${cleanPhone}` });
        } catch (err) {
          return JSON.stringify({ success: false, error: `Error de conexión con Evolution API: ${String(err)}` });
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

        // Resolve target users by name
        let targetUserIds: string[] = [];
        const targetUserNames: string[] = [];
        if (Array.isArray(args.target_users) && args.target_users.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").neq("user_id", userId);
          for (const name of args.target_users as string[]) {
            const match = profiles?.find((p: any) => p.full_name?.toLowerCase().includes(name.toLowerCase()));
            if (match) {
              targetUserIds.push(match.user_id);
              targetUserNames.push(match.full_name || name);
            }
          }
        }

        const { data, error } = await supabase.from("general_reminders").insert({
          user_id: userId,
          title,
          description: args.description || null,
          reminder_date: reminderDate,
          priority: args.priority || "normal",
          category: args.category || "general",
          target_user_ids: targetUserIds.length > 0 ? targetUserIds : [],
        }).select("id, title, reminder_date").single();

        if (error) throw error;
        let msg = `Recordatorio "${(data as any).title}" creado para ${(data as any).reminder_date}`;
        if (targetUserNames.length > 0) msg += `. Asignado a: ${targetUserNames.join(", ")}`;
        return JSON.stringify({ success: true, message: msg });
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

        const eventId = (data as any).id;
        const addedParticipants: string[] = [];

        // Add participants if provided
        if (Array.isArray(args.participants) && args.participants.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").neq("user_id", userId);
          for (const p of args.participants as any[]) {
            const pName = String(p.name || "").toLowerCase();
            const match = profiles?.find((pr: any) => pr.full_name?.toLowerCase().includes(pName));
            if (match) {
              await supabase.from("event_participants").insert({
                event_id: eventId,
                user_id: match.user_id,
                permission: p.permission === "edit" ? "edit" : "view",
              });
              addedParticipants.push(match.full_name || pName);
            }
          }
        }

        let msg = `Evento "${(data as any).title}" creado para el ${(data as any).event_date} a las ${(data as any).start_time}`;
        if (addedParticipants.length > 0) msg += `. Participantes: ${addedParticipants.join(", ")}`;
        return JSON.stringify({ success: true, message: msg, event_id: eventId });
      }

      case "delete_calendar_event": {
        const search = String(args.search || "");
        if (!search) return JSON.stringify({ success: false, error: "Necesito el título del evento." });

        const { data: events } = await supabase.from("calendar_events").select("id, title, event_date").eq("creator_id", userId).ilike("title", `%${search}%`).order("event_date", { ascending: false }).limit(1);
        if (!events?.length) return JSON.stringify({ success: false, error: `No encontré un evento con "${search}"` });
        const evt = events[0] as any;

        // Delete participants first
        await supabase.from("event_participants").delete().eq("event_id", evt.id);
        const { error } = await supabase.from("calendar_events").delete().eq("id", evt.id);
        if (error) throw error;
        return JSON.stringify({ success: true, message: `Evento "${evt.title}" (${evt.event_date}) eliminado 🗑️` });
      }

      case "get_apps_config": {
        const { data, error } = await supabase
          .from("user_sidebar_config")
          .select("categories")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        const rawData = (data?.categories as any) || {};
        const apps = rawData.apps || [];
        const iconSize = rawData.appsIconSize || 2;
        return JSON.stringify({
          message: `Configuración actual del hub de apps`,
          icon_size: iconSize,
          categories: apps.map((c: any) => ({
            id: c.id,
            label: c.label,
            icon: c.icon || "Folder",
            color: c.color || "#6366f1",
            apps: c.items?.map((i: any) => ({ id: i.id, label: i.label, icon: i.icon, hidden: !!i.hidden })) || [],
          })),
        });
      }

      case "update_apps_config": {
        const action = String(args.action);
        const { data: existing } = await supabase
          .from("user_sidebar_config")
          .select("categories")
          .eq("user_id", userId)
          .maybeSingle();
        const rawData = (existing?.categories as any) || {};
        let apps = rawData.apps || [];
        let iconSize = rawData.appsIconSize || 2;

        switch (action) {
          case "set_icon_size":
            iconSize = Number(args.icon_size) || 2;
            break;
          case "add_category": {
            const id = `custom-${Date.now()}`;
            apps.push({ id, label: String(args.category_name || "Nueva"), icon: String(args.icon || "Folder"), color: String(args.color || "#6366f1"), items: [] });
            break;
          }
          case "rename_category":
            apps = apps.map((c: any) => c.id === args.category_id ? { ...c, label: String(args.category_name) } : c);
            break;
          case "delete_category": {
            const cat = apps.find((c: any) => c.id === args.category_id);
            apps = apps.filter((c: any) => c.id !== args.category_id);
            if (cat?.items?.length && apps.length) apps[0].items = [...apps[0].items, ...cat.items];
            break;
          }
          case "set_category_icon":
            apps = apps.map((c: any) => c.id === args.category_id ? { ...c, icon: String(args.icon) } : c);
            break;
          case "set_category_color":
            apps = apps.map((c: any) => c.id === args.category_id ? { ...c, color: String(args.color) } : c);
            break;
          case "set_app_icon":
            apps = apps.map((c: any) => ({
              ...c,
              items: c.items.map((i: any) => i.id === args.app_id ? { ...i, icon: String(args.icon) } : i),
            }));
            break;
          case "toggle_app_visibility":
            apps = apps.map((c: any) => ({
              ...c,
              items: c.items.map((i: any) => i.id === args.app_id ? { ...i, hidden: !i.hidden } : i),
            }));
            break;
          case "move_app": {
            let movedItem: any = null;
            apps = apps.map((c: any) => {
              const idx = c.items.findIndex((i: any) => i.id === args.app_id);
              if (idx >= 0) { movedItem = c.items[idx]; return { ...c, items: c.items.filter((_: any, i: number) => i !== idx) }; }
              return c;
            });
            if (movedItem) {
              apps = apps.map((c: any) => c.id === args.target_category_id ? { ...c, items: [...c.items, movedItem] } : c);
            }
            break;
          }
        }

        const merged = { ...rawData, apps, appsIconSize: iconSize };
        const { error } = await supabase
          .from("user_sidebar_config")
          .upsert({ user_id: userId, categories: merged }, { onConflict: "user_id" });
        if (error) throw error;
        return JSON.stringify({ success: true, message: `Aplicaciones actualizadas: ${action}` });
      }

      case "get_ai_memories": {
        const leadId = args.lead_id ? String(args.lead_id) : null;
        const cat = args.category ? String(args.category) : null;
        let query = supabase.from("ai_memory").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(30);
        if (leadId) query = query.eq("lead_id", leadId);
        if (cat) query = query.eq("category", cat);
        const { data, error } = await query;
        if (error) throw error;
        if (!data?.length) return JSON.stringify({ message: "No hay recuerdos almacenados." });
        return JSON.stringify({
          message: `${data.length} recuerdo(s) encontrados`,
          memories: data.map((m: any) => ({ id: m.id, key: m.memory_key, value: m.memory_value, category: m.category, lead_id: m.lead_id, updated: m.updated_at })),
        });
      }

      case "save_ai_memory": {
        const memKey = String(args.memory_key || "");
        const memValue = args.memory_value || {};
        const cat = String(args.category || "general");
        const leadId = args.lead_id ? String(args.lead_id) : null;
        if (!memKey) return JSON.stringify({ error: "memory_key es obligatorio" });

        // Upsert: check existing
        let query = supabase.from("ai_memory").select("id").eq("user_id", userId).eq("memory_key", memKey);
        if (leadId) query = query.eq("lead_id", leadId);
        else query = query.is("lead_id", null);
        const { data: existing } = await query.limit(1);

        if (existing?.length) {
          const { error } = await supabase.from("ai_memory").update({ memory_value: memValue, category: cat }).eq("id", (existing[0] as any).id);
          if (error) throw error;
          return JSON.stringify({ success: true, message: `Recuerdo "${memKey}" actualizado.`, action: "updated" });
        }

        const { error } = await supabase.from("ai_memory").insert({ user_id: userId, lead_id: leadId, memory_key: memKey, memory_value: memValue, category: cat });
        if (error) throw error;
        return JSON.stringify({ success: true, message: `Recuerdo "${memKey}" guardado.`, action: "created" });
      }

      case "delete_ai_memory": {
        const memId = String(args.memory_id || "");
        if (!memId) return JSON.stringify({ error: "memory_id es obligatorio" });
        const { error } = await supabase.from("ai_memory").delete().eq("id", memId).eq("user_id", userId);
        if (error) throw error;
        return JSON.stringify({ success: true, message: "Recuerdo eliminado." });
      }

      case "view_ai_memory_file": {
        const searchTerm = String(args.search || "");
        const memoryId = String(args.memory_id || "");
        
        let memQuery = supabase.from("ai_memory").select("*").eq("user_id", userId);
        if (memoryId) {
          memQuery = memQuery.eq("id", memoryId);
        } else if (searchTerm) {
          memQuery = memQuery.or(`memory_key.ilike.%${searchTerm}%,category.in.(image,document)`);
        } else {
          return JSON.stringify({ error: "Necesitas indicar search o memory_id" });
        }
        
        const { data: memFiles, error: memErr } = await memQuery.limit(10);
        if (memErr) throw memErr;
        
        // Filter to find matching file memories
        const fileMemories = (memFiles || []).filter((m: any) => {
          const val = m.memory_value;
          if (!val) return false;
          const hasFile = val.file_url || val.content || val.source === 'file_upload';
          if (memoryId) return hasFile;
          if (searchTerm) {
            const s = searchTerm.toLowerCase();
            return hasFile && (
              m.memory_key.toLowerCase().includes(s) ||
              (val.file_name && val.file_name.toLowerCase().includes(s)) ||
              JSON.stringify(val).toLowerCase().includes(s)
            );
          }
          return hasFile;
        });
        
        if (!fileMemories.length) {
          // Fallback: search all memory with file data
          const { data: allMem } = await supabase.from("ai_memory").select("*").eq("user_id", userId)
            .in("category", ["image", "document"]).limit(20);
          const matches = (allMem || []).filter((m: any) => {
            if (!searchTerm) return true;
            const s = searchTerm.toLowerCase();
            return m.memory_key.toLowerCase().includes(s) || 
              (m.memory_value?.file_name && m.memory_value.file_name.toLowerCase().includes(s));
          });
          if (!matches.length) return JSON.stringify({ error: "No se encontró ningún archivo en la memoria IA con ese nombre" });
          
          const results = matches.map((m: any) => {
            const val = m.memory_value;
            return {
              id: m.id,
              key: m.memory_key,
              category: m.category,
              file_name: val.file_name,
              file_url: val.file_url,
              has_content: !!val.content,
              content_preview: val.content ? val.content.substring(0, 5000) : undefined,
            };
          });
          return JSON.stringify({ message: `${results.length} archivo(s) encontrados en memoria IA`, files: results });
        }
        
        // Return file data with content
        const results = await Promise.all(fileMemories.map(async (m: any) => {
          const val = m.memory_value;
          const result: any = {
            id: m.id,
            key: m.memory_key,
            category: m.category,
            file_name: val.file_name,
            file_type: val.file_type,
          };
          
          if (val.file_url) {
            result.file_url = val.file_url;
            const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(val.file_name || '') || (val.file_type && val.file_type.startsWith('image/'));
            result.is_image = isImage;
            if (isImage) {
              result.message = "URL de imagen disponible. Descríbela al usuario.";
            } else {
              // Try to fetch text content for non-image files
              try {
                const res = await fetch(val.file_url);
                const text = await res.text();
                result.content = text.substring(0, 20000);
              } catch {
                result.message = "Archivo disponible en la URL pero no se pudo leer su contenido";
              }
            }
          }
          
          if (val.content) {
            result.content = val.content.substring(0, 20000);
          }
          
          return result;
        }));
        
        return JSON.stringify({ message: `${results.length} archivo(s) de memoria IA`, files: results });
      }

      case "view_shared_file": {
        const fileName = String(args.file_name || "");
        const fileId = String(args.file_id || "");
        
        let query = supabase.from("shared_files").select("id, file_name, file_path, file_type, file_size, description");
        if (fileId) {
          query = query.eq("id", fileId);
        } else if (fileName) {
          query = query.ilike("file_name", `%${fileName}%`);
        } else {
          return JSON.stringify({ error: "Necesitas indicar file_name o file_id" });
        }
        
        const { data: files, error: fileErr } = await query.limit(1).maybeSingle();
        if (fileErr || !files) return JSON.stringify({ error: "Archivo no encontrado" });
        
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/shared-files/${files.file_path}`;
        
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(files.file_name);
        const isText = /\.(txt|md|csv|json|xml|html|css|js|ts|log|sql|yaml|yml)$/i.test(files.file_name);
        
        if (isText) {
          // Fetch and return text content
          try {
            const res = await fetch(publicUrl);
            const text = await res.text();
            return JSON.stringify({
              file: { nombre: files.file_name, tipo: files.file_type, url: publicUrl },
              content: text.substring(0, 30000),
            });
          } catch {
            return JSON.stringify({ file: { nombre: files.file_name, url: publicUrl }, error: "No se pudo leer el contenido" });
          }
        }
        
        return JSON.stringify({
          file: { nombre: files.file_name, tipo: files.file_type, tamaño: formatBytes(files.file_size), url: publicUrl, descripcion: files.description },
          is_image: isImage,
          message: isImage ? "Usa la URL para ver/describir la imagen" : "Archivo disponible en la URL",
        });
      }

      case "send_notification": {
        const title = String(args.title || "");
        const message = String(args.message || "");
        if (!title || !message) return JSON.stringify({ error: "Se requiere title y message" });
        
        let targetId = userId;
        if (args.target_user) {
          const { data: targetProfile } = await supabase
            .from("profiles")
            .select("user_id")
            .ilike("full_name", `%${args.target_user}%`)
            .maybeSingle();
          if (targetProfile) targetId = targetProfile.user_id;
        }
        
        const { error } = await supabase.from("custom_notifications").insert({
          user_id: targetId,
          title,
          message,
          type: String(args.type || "ai"),
          source: "Fluiditos",
          is_popup: args.is_popup !== false,
        });
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, message: `Notificación enviada: "${title}"` });
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
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
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

    // Load user's AI memories for context
    const { data: userMemories } = await supabase
      .from("ai_memory")
      .select("memory_key, memory_value, category, lead_id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);

    const memoryContext = userMemories?.length
      ? `\n\nRECUERDOS ALMACENADOS (usa esta información para personalizar tus respuestas):\n${userMemories.map((m: any) => `- [${m.category}] ${m.memory_key}: ${JSON.stringify(m.memory_value)}${m.lead_id ? ` (lead: ${m.lead_id})` : ''}`).join('\n')}`
      : '';

    const systemPrompt = `Eres Fluiditos, el asistente virtual de MalagaMicro CRM. Eres una criatura fluida, adorable y amigable con las mismas capacidades que un administrador.

Fecha actual: ${today}

Tu buzón de correo dedicado: ia@malagamicro.com (envías y recibes correos desde esta cuenta)

Personalidad:
- Amable, entusiasta y servicial
- Hablas en español con tono cercano pero profesional
- Respuestas concisas y útiles
- Te gusta hacer referencias a que eres una criatura fluida/acuática 💧

HERRAMIENTAS DISPONIBLES:
📖 LECTURA (ejecución directa):
- get_team_users, get_shared_files, get_shared_folders
- get_inbox (ver correos recibidos en tu buzón ia@malagamicro.com)
- get_leads, get_reminders, get_ostickets
- get_calendar_events, get_budgets, get_apps_config
- sync_inbox_imap (sincronizar tu buzón ia@malagamicro.com desde el servidor)
- read_email (leer el contenido completo de un correo)
- search_emails (buscar correos por asunto, remitente o contenido)
- get_ai_memories (consultar recuerdos almacenados sobre leads o usuario)
- view_shared_file (ver/describir un archivo o imagen compartida - busca por nombre)
- view_ai_memory_file (leer archivos de la Memoria IA: PDF, DOCX, Excel, imágenes, texto, CSV y más - el texto se extrae automáticamente al subirse)

🖼️ CAPACIDAD VISUAL Y DOCUMENTAL:
- Puedes recibir y analizar imágenes que el usuario adjunte directamente en el chat.
- Puedes leer el contenido COMPLETO de PDFs, DOCX, Excel y otros documentos subidos a la Memoria IA.
- Los documentos binarios (PDF, DOCX, etc.) tienen su texto extraído automáticamente al subirse, así que puedes acceder a su contenido textual completo.
- Puedes buscar y ver imágenes/archivos del sistema usando view_shared_file O view_ai_memory_file.
- Cuando recibas una imagen, descríbela con detalle: colores, texto visible, logos, contenido.
- Si el usuario pregunta por "el logo" o cualquier imagen/archivo, busca PRIMERO en view_ai_memory_file (memoria IA) y LUEGO en view_shared_file (archivos compartidos).
- Para archivos de la memoria IA (subidos por el admin), usa view_ai_memory_file.

✍️ ESCRITURA (REQUIEREN CONFIRMACIÓN):
- send_internal_message, send_email (envía desde ia@malagamicro.com), send_whatsapp
- create_lead, update_lead
- create_reminder (puede asignar a otros usuarios), complete_reminder
- create_calendar_event (puede añadir participantes del equipo), delete_calendar_event
- update_apps_config (personalizar el hub de aplicaciones: cambiar iconos, colores, categorías, tamaño)

🧠 MEMORIA (ejecución directa, NO requieren confirmación):
- save_ai_memory: Guarda automáticamente información relevante tras conversaciones (preferencias del cliente, acuerdos, datos clave). Categorías: general, preference, interaction, note.
- delete_ai_memory: Eliminar un recuerdo obsoleto.

INSTRUCCIONES DE MEMORIA INTELIGENTE:
Debes guardar información automáticamente con save_ai_memory (SIN pedir confirmación) cuando detectes cualquiera de estos patrones en la conversación:

📌 GUARDAR SIEMPRE (categoría "preference"):
- Preferencias de contacto del usuario ("prefiero que me llamen por la mañana", "no me mandes correos los viernes")
- Preferencias de formato o estilo ("siempre quiero los correos formales", "usa tuteo")
- Configuraciones repetidas ("siempre envío a este email", "mi firma es...")

📌 GUARDAR SIEMPRE (categoría "interaction"):
- Acuerdos comerciales mencionados ("cerramos trato con X por 5000€", "descuento del 10% para Y")
- Resultados de reuniones o llamadas ("hablé con X, le interesa el producto Z")
- Seguimientos importantes ("X me pidió presupuesto, se lo envío el lunes")
- Datos de contacto nuevos mencionados en conversación ("el móvil de Juan es 666...")

📌 GUARDAR SIEMPRE (categoría "note"):
- Datos clave sobre leads/clientes ("Empresa X tiene 50 empleados", "facturan 2M al año")
- Problemas o quejas recurrentes ("el cliente Y se quejó del plazo de entrega")
- Oportunidades detectadas ("X mencionó que necesitan proveedor de mantenimiento")

📌 GUARDAR SIEMPRE (categoría "general"):
- Instrucciones recurrentes del usuario ("cuando cree leads ponles siempre estado contactado")
- Flujos de trabajo del usuario ("primero creo el lead, luego envío correo de bienvenida")
- Contexto de negocio ("nuestro producto estrella es X", "temporada alta es de junio a septiembre")

⚠️ NO GUARDAR:
- Saludos o charla casual sin información útil
- Datos que ya están guardados en los recuerdos cargados (evita duplicados)
- Información temporal sin valor futuro ("¿qué hora es?")

FORMATO DE GUARDADO:
- memory_key: nombre descriptivo en snake_case (ej: "preferencia_horario_contacto", "acuerdo_empresa_x")
- memory_value: objeto JSON con campos claros: { "detalle": "...", "contexto": "...", "fecha": "YYYY-MM-DD" }
- Si hay un lead relacionado, incluye su lead_id
- Guarda el recuerdo AL FINAL de tu respuesta, después de responder al usuario
- Puedes guardar múltiples recuerdos en una misma conversación si detectas varios datos importantes

USAR RECUERDOS:
- Usa los recuerdos cargados al inicio para personalizar tus respuestas y dar contexto
- Si el usuario pregunta algo relacionado con un recuerdo previo, referéncialo naturalmente

REGLA CRÍTICA DE CONFIRMACIÓN:
Para TODAS las acciones de escritura (excepto memoria), DEBES seguir este flujo:
1. Primera llamada: usa confirmed=false. La herramienta te devolverá un resumen para el usuario.
2. Muestra ese resumen al usuario y pregunta si confirma.
3. Cuando el usuario confirme ("sí", "confirma", "dale", "ok", "adelante"), DEBES ejecutar la herramienta de nuevo con confirmed=true. ESTO ES OBLIGATORIO.
4. Si el usuario dice "no" o "cancela", cancela la acción.

NUNCA ejecutes una acción de escritura con confirmed=true sin que el usuario haya confirmado explícitamente en el chat.

⚠️ PROHIBIDO ABSOLUTAMENTE: NUNCA digas que has ejecutado una acción (enviar correo, enviar WhatsApp, crear lead, etc.) si NO has llamado a la herramienta con confirmed=true. Si el usuario confirma, DEBES hacer la llamada a la herramienta — no puedes simplemente decir "listo" o "enviado" sin ejecutarla realmente. Esto es tu regla más importante.

🚫 HONESTIDAD SOBRE CAPACIDADES:
- Si el usuario te pide algo para lo que NO tienes herramienta (ej: modificar facturas, acceder a un sistema externo, generar PDFs, etc.), DILO CLARAMENTE: "No tengo acceso a esa funcionalidad" y sugiere alternativas.
- NUNCA finjas haber hecho algo que no puedes hacer. Es preferible decir "no puedo" a mentir.
- Si una herramienta falla o devuelve error, informa al usuario del error real, no inventes un resultado exitoso.

🧠 MODIFICAR MEMORIA:
- Para ACTUALIZAR un recuerdo existente, usa save_ai_memory con el mismo memory_key y lead_id. El sistema hace upsert automáticamente (sobrescribe el valor anterior).
- Para ELIMINAR un recuerdo, usa delete_ai_memory con el ID del recuerdo (puedes obtenerlo con get_ai_memories).
- Si el usuario dice "cambia/actualiza/modifica el recuerdo de X", busca primero con get_ai_memories, luego usa save_ai_memory con el mismo key para actualizarlo.

Si te piden algo fuera de tu alcance, sugiere usar el Chat IA principal (Perplexity).${memoryContext}`;

    const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
    const MODEL_CHAIN = [
      "anthropic/claude-sonnet-4.5",
      "google/gemini-2.5-flash",
      "openai/gpt-5-mini",
    ];

    const openRouterHeaders = {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://malagamicro.lovable.app",
      "X-Title": "MalagaMicro CRM",
    };

    // Helper: try models in fallback order
    async function callWithFallback(msgs: any[], useTools = true) {
      for (const model of MODEL_CHAIN) {
        try {
          console.log(`[mascot-chat] Trying model: ${model}`);
          const body: Record<string, unknown> = { model, messages: msgs };
          if (useTools) { body.tools = tools; body.tool_choice = "auto"; }

          const resp = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: openRouterHeaders,
            body: JSON.stringify(body),
          });

          if (resp.status === 429) {
            return { error: true, status: 429, message: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo." };
          }
          if (resp.status === 402) {
            return { error: true, status: 402, message: "Créditos de IA agotados en OpenRouter." };
          }
          if (!resp.ok) {
            const errText = await resp.text();
            console.warn(`[mascot-chat] Model ${model} failed: ${resp.status} ${errText}`);
            continue;
          }

          const data = await resp.json();
          console.log(`[mascot-chat] Success with model: ${model}`);
          return { error: false, data, model };
        } catch (err) {
          console.warn(`[mascot-chat] Model ${model} threw:`, err);
          continue;
        }
      }
      return { error: true, status: 502, message: "Todos los modelos de IA fallaron." };
    }

    let chatMessages = [{ role: "system", content: systemPrompt }, ...(messages ?? [])];

    let result = await callWithFallback(chatMessages);
    if (result.error) {
      return new Response(JSON.stringify({ error: result.message }), {
        status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let assistantMessage = result.data.choices?.[0]?.message;

    const MAX_TOOL_ITERATIONS = 8;
    let iterations = 0;
    let accumulatedContent = assistantMessage?.content || "";

    while (assistantMessage?.tool_calls && iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      // Capture any content the model returned alongside tool calls
      if (assistantMessage.content && !accumulatedContent) {
        accumulatedContent = assistantMessage.content;
      }
      chatMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs: Record<string, unknown> = {};
        try { toolArgs = JSON.parse(toolCall.function.arguments || "{}"); } catch { toolArgs = {}; }

        console.log(`[mascot-chat] Tool call: ${toolName}, args: ${JSON.stringify(toolArgs)}`);
        const toolResult = await executeToolCall(supabase, userId, toolName, toolArgs);
        console.log(`[mascot-chat] Tool result (${toolName}): ${toolResult.slice(0, 200)}`);
        chatMessages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });
      }

      result = await callWithFallback(chatMessages);
      if (result.error) { console.error("AI tool loop error:", result.status); break; }
      assistantMessage = result.data.choices?.[0]?.message;
      // Update accumulated content if model provided new text
      if (assistantMessage?.content) {
        accumulatedContent = assistantMessage.content;
      }
    }

    let finalContent = accumulatedContent || assistantMessage?.content || "No tengo respuesta en este momento.";

    // SAFETY CHECK: Detect when the model claims to have performed an action but didn't actually call the tool
    const actionClaimPatterns = /(?:¡?listo|enviado|correo enviado|email enviado|mensaje enviado|whatsapp enviado|lead creado|evento creado|recordatorio creado).*?✅/i;
    const hadToolCalls = chatMessages.some(m => m.role === "tool");
    
    if (actionClaimPatterns.test(finalContent) && !hadToolCalls && iterations === 0) {
      console.warn("[mascot-chat] SAFETY: Model claimed action completion without any tool calls! Forcing correction.");
      // Force the model to actually use tools
      chatMessages.push({ role: "assistant", content: finalContent });
      chatMessages.push({ 
        role: "user", 
        content: "SISTEMA: Has afirmado haber completado una acción pero NO has ejecutado ninguna herramienta. DEBES llamar a la herramienta correspondiente con confirmed=true AHORA. No puedes decir que algo está hecho sin ejecutar la herramienta." 
      });
      
      result = await callWithFallback(chatMessages);
      if (!result.error) {
        assistantMessage = result.data.choices?.[0]?.message;
        // Process any tool calls from the retry
        let retryIterations = 0;
        while (assistantMessage?.tool_calls && retryIterations < 3) {
          retryIterations++;
          chatMessages.push(assistantMessage);
          for (const toolCall of assistantMessage.tool_calls) {
            const toolName = toolCall.function.name;
            let toolArgs: Record<string, unknown> = {};
            try { toolArgs = JSON.parse(toolCall.function.arguments || "{}"); } catch { toolArgs = {}; }
            console.log(`[mascot-chat] RETRY Tool call: ${toolName}, args: ${JSON.stringify(toolArgs)}`);
            const toolResult = await executeToolCall(supabase, userId, toolName, toolArgs);
            console.log(`[mascot-chat] RETRY Tool result (${toolName}): ${toolResult.slice(0, 200)}`);
            chatMessages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });
          }
          result = await callWithFallback(chatMessages);
          if (result.error) break;
          assistantMessage = result.data.choices?.[0]?.message;
        }
        finalContent = assistantMessage?.content || finalContent;
      }
    }

    console.log(`[mascot-chat] Final response (tool_calls_made: ${hadToolCalls}, iterations: ${iterations})`);
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
