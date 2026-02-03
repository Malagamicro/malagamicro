import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

const tools = [
  // Lead Management
  {
    type: "function",
    function: {
      name: "search_leads",
      description: "Buscar leads por nombre de empresa, contacto, teléfono, email o ciudad. Usa esto cuando el usuario pregunte sobre leads específicos o quiera encontrar información.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto a buscar" },
          status: { type: "string", enum: ["nuevo", "contactado", "interesado", "cliente"], description: "Filtrar por estado" },
          limit: { type: "number", description: "Número máximo de resultados (default 10)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_all_leads",
      description: "Obtener todos los leads del usuario con filtros opcionales. Usa esto para ver la lista completa de leads o filtrar por estado.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["nuevo", "contactado", "interesado", "cliente"], description: "Filtrar por estado" },
          limit: { type: "number", description: "Número máximo de resultados (default 50)" },
          orderBy: { type: "string", enum: ["created_at", "updated_at", "company_name", "score"], description: "Ordenar por campo" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_lead_stats",
      description: "Obtener estadísticas generales de leads: total, por estado, tasa de conversión, leads recientes. Usa esto cuando el usuario pregunte por métricas, reportes o estadísticas.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Crear un nuevo lead. Usa esto cuando el usuario quiera añadir un nuevo lead o prospecto.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Nombre de la empresa (requerido)" },
          contact_name: { type: "string", description: "Nombre del contacto" },
          phone: { type: "string", description: "Teléfono" },
          email: { type: "string", description: "Email" },
          city: { type: "string", description: "Ciudad (default: Málaga)" },
          notes: { type: "string", description: "Notas adicionales" },
          segment: { type: "string", enum: ["pyme", "autonomo", "corporativo"], description: "Segmento" },
          source: { type: "string", description: "Fuente del lead" },
        },
        required: ["company_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead",
      description: "Actualizar un lead existente. Usa esto cuando el usuario quiera modificar información de un lead.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID del lead a actualizar" },
          company_name: { type: "string" },
          contact_name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          status: { type: "string", enum: ["nuevo", "contactado", "interesado", "cliente"] },
          notes: { type: "string" },
          score: { type: "number", description: "Puntuación del lead (0-100)" },
        },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_lead",
      description: "Eliminar un lead. Usa esto cuando el usuario quiera borrar un lead del sistema.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID del lead a eliminar" },
        },
        required: ["lead_id"],
      },
    },
  },
  // Activities & Reminders
  {
    type: "function",
    function: {
      name: "get_recent_activities",
      description: "Obtener actividades recientes del CRM: últimos leads creados, últimas interacciones. Usa esto para mostrar actividad reciente.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Número de actividades (default 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pending_reminders",
      description: "Obtener recordatorios pendientes de leads. Usa esto cuando el usuario pregunte por tareas o seguimientos pendientes.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_general_reminders",
      description: "Obtener recordatorios generales (no asociados a leads). Usa esto para ver todas las tareas y recordatorios generales.",
      parameters: {
        type: "object",
        properties: {
          include_completed: { type: "boolean", description: "Incluir recordatorios completados" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Crear un nuevo recordatorio general. Usa esto cuando el usuario quiera añadir una tarea o recordatorio.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título del recordatorio" },
          description: { type: "string", description: "Descripción detallada" },
          reminder_date: { type: "string", description: "Fecha y hora (formato ISO)" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Prioridad" },
          category: { type: "string", description: "Categoría del recordatorio" },
        },
        required: ["title", "reminder_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_reminder",
      description: "Marcar un recordatorio como completado.",
      parameters: {
        type: "object",
        properties: {
          reminder_id: { type: "string", description: "ID del recordatorio" },
        },
        required: ["reminder_id"],
      },
    },
  },
  // Internal Messaging
  {
    type: "function",
    function: {
      name: "send_internal_message",
      description: "Enviar un mensaje interno a otro usuario del sistema. Usa esto cuando el usuario te pida enviar un mensaje a un compañero o miembro del equipo.",
      parameters: {
        type: "object",
        properties: {
          recipient_name: { type: "string", description: "Nombre del usuario destinatario" },
          message: { type: "string", description: "Contenido del mensaje a enviar" },
        },
        required: ["recipient_name", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_team_users",
      description: "Obtener lista de usuarios del equipo disponibles para mensajería. Usa esto cuando necesites saber a quién se puede enviar mensajes.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_unread_messages",
      description: "Obtener mensajes internos no leídos del usuario.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  // Templates
  {
    type: "function",
    function: {
      name: "get_message_templates",
      description: "Obtener plantillas de mensajes guardadas. Usa esto para ver las plantillas disponibles para WhatsApp u otros mensajes.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Filtrar por categoría" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_message_template",
      description: "Crear una nueva plantilla de mensaje.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre de la plantilla" },
          content: { type: "string", description: "Contenido del mensaje" },
          category: { type: "string", description: "Categoría (ventas, soporte, bienvenida, seguimiento, otros)" },
        },
        required: ["name", "content"],
      },
    },
  },
  // Shared Files
  {
    type: "function",
    function: {
      name: "get_shared_files",
      description: "Obtener archivos compartidos del usuario. Usa esto para ver documentos, imágenes u otros archivos subidos.",
      parameters: {
        type: "object",
        properties: {
          folder_id: { type: "string", description: "ID de carpeta para filtrar" },
          limit: { type: "number", description: "Número máximo de archivos" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_shared_folders",
      description: "Obtener carpetas de archivos compartidos.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  // Email Campaigns
  {
    type: "function",
    function: {
      name: "get_email_campaigns",
      description: "Obtener campañas de email con sus estadísticas.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "scheduled", "sent"], description: "Filtrar por estado" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_email_templates",
      description: "Obtener plantillas de email disponibles.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  // WhatsApp
  {
    type: "function",
    function: {
      name: "get_whatsapp_chats",
      description: "Obtener conversaciones de WhatsApp activas.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Número máximo de chats" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_whatsapp_messages",
      description: "Obtener mensajes de WhatsApp de un chat específico.",
      parameters: {
        type: "object",
        properties: {
          chat_id: { type: "string", description: "ID del chat de WhatsApp" },
          limit: { type: "number", description: "Número máximo de mensajes" },
        },
        required: ["chat_id"],
      },
    },
  },
  // Lead Folders
  {
    type: "function",
    function: {
      name: "get_lead_folders",
      description: "Obtener carpetas de leads para organización.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  // Audit & Analytics
  {
    type: "function",
    function: {
      name: "get_audit_logs",
      description: "Obtener registro de auditoría de acciones realizadas en el sistema.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Número máximo de registros" },
          entity_type: { type: "string", description: "Filtrar por tipo de entidad (lead, template, etc)" },
        },
        required: [],
      },
    },
  },
  // OsTicket
  {
    type: "function",
    function: {
      name: "get_osticket_tickets",
      description: "Obtener tickets de soporte de osTicket.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Número máximo de tickets" },
        },
        required: [],
      },
    },
  },
];

async function executeToolCall(
  supabase: any,
  userId: string,
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  try {
    switch (toolName) {
      case "search_leads": {
        const query = args.query?.toLowerCase() || "";
        const limit = args.limit || 10;
        
        let queryBuilder = supabase
          .from("leads")
          .select("id, company_name, contact_name, phone, email, city, status, score, notes, created_at")
          .eq("user_id", userId)
          .or(`company_name.ilike.%${query}%,contact_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%,city.ilike.%${query}%`)
          .limit(limit);
        
        if (args.status) {
          queryBuilder = queryBuilder.eq("status", args.status);
        }
        
        const { data, error } = await queryBuilder;
        if (error) throw error;
        
        if (!data || data.length === 0) {
          return JSON.stringify({ message: "No se encontraron leads con ese criterio", results: [] });
        }
        
        return JSON.stringify({
          message: `Encontrados ${data.length} leads`,
          results: data.map((l: any) => ({
            id: l.id,
            empresa: l.company_name,
            contacto: l.contact_name,
            telefono: l.phone,
            email: l.email,
            ciudad: l.city,
            estado: l.status,
            score: l.score,
            notas: l.notes?.substring(0, 100),
            creado: new Date(l.created_at).toLocaleDateString("es-ES"),
          })),
        });
      }

      case "get_all_leads": {
        const limit = args.limit || 50;
        const orderBy = args.orderBy || "created_at";
        
        let queryBuilder = supabase
          .from("leads")
          .select("id, company_name, contact_name, phone, email, city, status, score, segment, source, created_at")
          .eq("user_id", userId)
          .order(orderBy, { ascending: false })
          .limit(limit);
        
        if (args.status) {
          queryBuilder = queryBuilder.eq("status", args.status);
        }
        
        const { data, error } = await queryBuilder;
        if (error) throw error;
        
        return JSON.stringify({
          total: data?.length || 0,
          leads: data?.map((l: any) => ({
            id: l.id,
            empresa: l.company_name,
            contacto: l.contact_name,
            telefono: l.phone,
            email: l.email,
            ciudad: l.city,
            estado: l.status,
            score: l.score,
            segmento: l.segment,
            fuente: l.source,
            creado: new Date(l.created_at).toLocaleDateString("es-ES"),
          })) || [],
        });
      }
      
      case "get_lead_stats": {
        const { data: leads, error } = await supabase
          .from("leads")
          .select("status, created_at, score")
          .eq("user_id", userId);
        
        if (error) throw error;
        
        const total = leads?.length || 0;
        const byStatus = {
          nuevo: leads?.filter((l: any) => l.status === "nuevo").length || 0,
          contactado: leads?.filter((l: any) => l.status === "contactado").length || 0,
          interesado: leads?.filter((l: any) => l.status === "interesado").length || 0,
          cliente: leads?.filter((l: any) => l.status === "cliente").length || 0,
        };
        
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentLeads = leads?.filter((l: any) => new Date(l.created_at) > weekAgo).length || 0;
        
        const avgScore = total > 0 ? Math.round(leads?.reduce((acc: number, l: any) => acc + (l.score || 0), 0) / total) : 0;
        const conversionRate = total > 0 ? ((byStatus.cliente / total) * 100).toFixed(1) : 0;
        
        return JSON.stringify({
          total_leads: total,
          por_estado: byStatus,
          leads_esta_semana: recentLeads,
          tasa_conversion: `${conversionRate}%`,
          score_promedio: avgScore,
        });
      }
      
      case "create_lead": {
        const { data, error } = await supabase
          .from("leads")
          .insert({
            user_id: userId,
            company_name: args.company_name,
            contact_name: args.contact_name || null,
            phone: args.phone || null,
            email: args.email || null,
            city: args.city || "Málaga",
            notes: args.notes || null,
            status: "nuevo",
            segment: args.segment || "pyme",
            source: args.source || "ia-assistant",
          })
          .select("id, company_name")
          .single();
        
        if (error) throw error;
        
        return JSON.stringify({
          success: true,
          message: `Lead "${data.company_name}" creado exitosamente`,
          lead_id: data.id,
        });
      }
      
      case "update_lead": {
        const { lead_id, ...updateData } = args;
        const updateFields: Record<string, any> = {};
        
        if (updateData.company_name) updateFields.company_name = updateData.company_name;
        if (updateData.contact_name) updateFields.contact_name = updateData.contact_name;
        if (updateData.phone) updateFields.phone = updateData.phone;
        if (updateData.email) updateFields.email = updateData.email;
        if (updateData.status) updateFields.status = updateData.status;
        if (updateData.notes) updateFields.notes = updateData.notes;
        if (updateData.score !== undefined) updateFields.score = updateData.score;
        
        const { data, error } = await supabase
          .from("leads")
          .update(updateFields)
          .eq("id", lead_id)
          .eq("user_id", userId)
          .select("id, company_name")
          .single();
        
        if (error) throw error;
        
        return JSON.stringify({
          success: true,
          message: `Lead "${data.company_name}" actualizado`,
        });
      }

      case "delete_lead": {
        const { data, error } = await supabase
          .from("leads")
          .delete()
          .eq("id", args.lead_id)
          .eq("user_id", userId)
          .select("company_name")
          .single();
        
        if (error) throw error;
        
        return JSON.stringify({
          success: true,
          message: `Lead "${data.company_name}" eliminado`,
        });
      }
      
      case "get_recent_activities": {
        const limit = args.limit || 10;
        
        const { data: activities, error } = await supabase
          .from("lead_activities")
          .select("id, type, description, created_at, lead_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit);
        
        if (error) throw error;
        
        return JSON.stringify({
          actividades: activities?.map((a: any) => ({
            tipo: a.type,
            descripcion: a.description,
            fecha: new Date(a.created_at).toLocaleDateString("es-ES"),
          })) || [],
        });
      }
      
      case "get_pending_reminders": {
        const { data: reminders, error } = await supabase
          .from("follow_up_reminders")
          .select("id, message, reminder_date, lead_id, leads(company_name)")
          .eq("user_id", userId)
          .eq("is_completed", false)
          .gte("reminder_date", new Date().toISOString())
          .order("reminder_date", { ascending: true })
          .limit(10);
        
        if (error) throw error;
        
        return JSON.stringify({
          recordatorios_pendientes: reminders?.map((r: any) => ({
            id: r.id,
            mensaje: r.message,
            fecha: new Date(r.reminder_date).toLocaleString("es-ES"),
            empresa: r.leads?.company_name,
          })) || [],
        });
      }

      case "get_general_reminders": {
        let queryBuilder = supabase
          .from("general_reminders")
          .select("*")
          .eq("user_id", userId)
          .order("reminder_date", { ascending: true });
        
        if (!args.include_completed) {
          queryBuilder = queryBuilder.eq("is_completed", false);
        }
        
        const { data, error } = await queryBuilder.limit(20);
        if (error) throw error;
        
        return JSON.stringify({
          recordatorios: data?.map((r: any) => ({
            id: r.id,
            titulo: r.title,
            descripcion: r.description,
            fecha: new Date(r.reminder_date).toLocaleString("es-ES"),
            prioridad: r.priority,
            categoria: r.category,
            completado: r.is_completed,
          })) || [],
        });
      }

      case "create_reminder": {
        const { data, error } = await supabase
          .from("general_reminders")
          .insert({
            user_id: userId,
            title: args.title,
            description: args.description || null,
            reminder_date: args.reminder_date,
            priority: args.priority || "medium",
            category: args.category || null,
          })
          .select("id, title")
          .single();
        
        if (error) throw error;
        
        return JSON.stringify({
          success: true,
          message: `Recordatorio "${data.title}" creado`,
          reminder_id: data.id,
        });
      }

      case "complete_reminder": {
        const { data, error } = await supabase
          .from("general_reminders")
          .update({ is_completed: true })
          .eq("id", args.reminder_id)
          .eq("user_id", userId)
          .select("title")
          .single();
        
        if (error) throw error;
        
        return JSON.stringify({
          success: true,
          message: `Recordatorio "${data.title}" completado`,
        });
      }
      
      case "get_team_users": {
        const { data: users, error } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .neq("user_id", userId);
        
        if (error) throw error;
        
        return JSON.stringify({
          usuarios: users?.map((u: any) => ({
            id: u.user_id,
            nombre: u.full_name || "Usuario sin nombre",
            avatar: u.avatar_url,
          })) || [],
        });
      }
      
      case "send_internal_message": {
        const { recipient_name, message } = args;
        
        const { data: recipients, error: recipientError } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .ilike("full_name", `%${recipient_name}%`)
          .limit(1);
        
        if (recipientError) throw recipientError;
        
        if (!recipients || recipients.length === 0) {
          return JSON.stringify({
            success: false,
            error: `No se encontró usuario con nombre "${recipient_name}"`,
          });
        }
        
        const recipientId = recipients[0].user_id;
        const recipientFullName = recipients[0].full_name;
        
        const { data: existingParticipations } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", userId);
        
        let conversationId: string | null = null;
        
        if (existingParticipations && existingParticipations.length > 0) {
          const convIds = existingParticipations.map((p: { conversation_id: string }) => p.conversation_id);
          
          const { data: conversations } = await supabase
            .from("internal_conversations")
            .select("id")
            .in("id", convIds)
            .eq("is_group", false);
          
          if (conversations) {
            for (const conv of conversations) {
              const { data: participants } = await supabase
                .from("conversation_participants")
                .select("user_id")
                .eq("conversation_id", conv.id);
              
              const participantIds = participants?.map((p: { user_id: string }) => p.user_id) || [];
              if (participantIds.includes(recipientId) && participantIds.length === 2) {
                conversationId = conv.id;
                break;
              }
            }
          }
        }
        
        if (!conversationId) {
          const { data: newConv, error: convError } = await supabase
            .from("internal_conversations")
            .insert({
              is_group: false,
              created_by: userId,
            })
            .select("id")
            .single();
          
          if (convError) throw convError;
          conversationId = newConv.id;
          
          await supabase.from("conversation_participants").insert([
            { conversation_id: conversationId, user_id: userId, is_admin: true },
            { conversation_id: conversationId, user_id: recipientId, is_admin: false },
          ]);
        }
        
        const { error: msgError } = await supabase
          .from("internal_messages")
          .insert({
            conversation_id: conversationId,
            sender_id: userId,
            content: message,
            message_type: "text",
          });
        
        if (msgError) throw msgError;
        
        await supabase
          .from("internal_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
        
        return JSON.stringify({
          success: true,
          message: `Mensaje enviado a ${recipientFullName}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
        });
      }

      case "get_unread_messages": {
        const { data: participations, error: partError } = await supabase
          .from("conversation_participants")
          .select("conversation_id, last_read_at")
          .eq("user_id", userId);
        
        if (partError) throw partError;
        
        let unreadCount = 0;
        const unreadChats: any[] = [];
        
        for (const part of participations || []) {
          const { data: messages } = await supabase
            .from("internal_messages")
            .select("id, content, sender_id, created_at")
            .eq("conversation_id", part.conversation_id)
            .neq("sender_id", userId)
            .gt("created_at", part.last_read_at || "1970-01-01")
            .order("created_at", { ascending: false })
            .limit(5);
          
          if (messages && messages.length > 0) {
            unreadCount += messages.length;
            unreadChats.push({
              conversation_id: part.conversation_id,
              mensajes_sin_leer: messages.length,
              ultimo_mensaje: messages[0].content?.substring(0, 50),
            });
          }
        }
        
        return JSON.stringify({
          total_sin_leer: unreadCount,
          conversaciones: unreadChats,
        });
      }

      case "get_message_templates": {
        let queryBuilder = supabase
          .from("message_templates")
          .select("id, name, content, category, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        
        if (args.category) {
          queryBuilder = queryBuilder.eq("category", args.category);
        }
        
        const { data, error } = await queryBuilder.limit(20);
        if (error) throw error;
        
        return JSON.stringify({
          plantillas: data?.map((t: any) => ({
            id: t.id,
            nombre: t.name,
            contenido: t.content.substring(0, 100),
            categoria: t.category,
          })) || [],
        });
      }

      case "create_message_template": {
        const { data, error } = await supabase
          .from("message_templates")
          .insert({
            user_id: userId,
            name: args.name,
            content: args.content,
            category: args.category || "general",
          })
          .select("id, name")
          .single();
        
        if (error) throw error;
        
        return JSON.stringify({
          success: true,
          message: `Plantilla "${data.name}" creada`,
          template_id: data.id,
        });
      }

      case "get_shared_files": {
        let queryBuilder = supabase
          .from("shared_files")
          .select("id, file_name, file_type, file_size, description, created_at, folder_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        
        if (args.folder_id) {
          queryBuilder = queryBuilder.eq("folder_id", args.folder_id);
        }
        
        const { data, error } = await queryBuilder.limit(args.limit || 20);
        if (error) throw error;
        
        return JSON.stringify({
          archivos: data?.map((f: any) => ({
            id: f.id,
            nombre: f.file_name,
            tipo: f.file_type,
            tamaño: `${(f.file_size / 1024).toFixed(1)} KB`,
            descripcion: f.description,
            fecha: new Date(f.created_at).toLocaleDateString("es-ES"),
          })) || [],
        });
      }

      case "get_shared_folders": {
        const { data, error } = await supabase
          .from("shared_folders")
          .select("id, name, color, parent_id, created_at")
          .eq("user_id", userId)
          .order("name");
        
        if (error) throw error;
        
        return JSON.stringify({
          carpetas: data?.map((f: any) => ({
            id: f.id,
            nombre: f.name,
            color: f.color,
          })) || [],
        });
      }

      case "get_email_campaigns": {
        let queryBuilder = supabase
          .from("email_campaigns")
          .select("id, name, status, total_recipients, total_sent, total_opened, sent_at, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        
        if (args.status) {
          queryBuilder = queryBuilder.eq("status", args.status);
        }
        
        const { data, error } = await queryBuilder.limit(10);
        if (error) throw error;
        
        return JSON.stringify({
          campañas: data?.map((c: any) => ({
            id: c.id,
            nombre: c.name,
            estado: c.status,
            destinatarios: c.total_recipients,
            enviados: c.total_sent,
            abiertos: c.total_opened,
            fecha_envio: c.sent_at ? new Date(c.sent_at).toLocaleDateString("es-ES") : null,
          })) || [],
        });
      }

      case "get_email_templates": {
        const { data, error } = await supabase
          .from("email_templates")
          .select("id, name, subject, is_active, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);
        
        if (error) throw error;
        
        return JSON.stringify({
          plantillas_email: data?.map((t: any) => ({
            id: t.id,
            nombre: t.name,
            asunto: t.subject,
            activa: t.is_active,
          })) || [],
        });
      }

      case "get_whatsapp_chats": {
        const { data, error } = await supabase
          .from("whatsapp_chats")
          .select("id, chat_id, phone, custom_name, unread_count, last_message_at")
          .eq("user_id", userId)
          .eq("is_archived", false)
          .order("last_message_at", { ascending: false })
          .limit(args.limit || 20);
        
        if (error) throw error;
        
        return JSON.stringify({
          chats_whatsapp: data?.map((c: any) => ({
            id: c.id,
            chat_id: c.chat_id,
            telefono: c.phone,
            nombre: c.custom_name,
            sin_leer: c.unread_count,
            ultimo_mensaje: c.last_message_at ? new Date(c.last_message_at).toLocaleString("es-ES") : null,
          })) || [],
        });
      }

      case "get_whatsapp_messages": {
        const { data, error } = await supabase
          .from("waha_messages")
          .select("id, content, from_me, timestamp, message_type")
          .eq("user_id", userId)
          .eq("chat_id", args.chat_id)
          .order("timestamp", { ascending: false })
          .limit(args.limit || 20);
        
        if (error) throw error;
        
        return JSON.stringify({
          mensajes: data?.map((m: any) => ({
            id: m.id,
            contenido: m.content?.substring(0, 200),
            enviado: m.from_me,
            fecha: new Date(m.timestamp).toLocaleString("es-ES"),
            tipo: m.message_type,
          })) || [],
        });
      }

      case "get_lead_folders": {
        const { data, error } = await supabase
          .from("lead_folders")
          .select("id, name, color")
          .eq("user_id", userId)
          .order("name");
        
        if (error) throw error;
        
        return JSON.stringify({
          carpetas_leads: data?.map((f: any) => ({
            id: f.id,
            nombre: f.name,
            color: f.color,
          })) || [],
        });
      }

      case "get_audit_logs": {
        let queryBuilder = supabase
          .from("audit_logs")
          .select("id, action, entity_type, entity_id, details, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        
        if (args.entity_type) {
          queryBuilder = queryBuilder.eq("entity_type", args.entity_type);
        }
        
        const { data, error } = await queryBuilder.limit(args.limit || 20);
        if (error) throw error;
        
        return JSON.stringify({
          registros: data?.map((l: any) => ({
            accion: l.action,
            tipo: l.entity_type,
            detalles: l.details,
            fecha: new Date(l.created_at).toLocaleString("es-ES"),
          })) || [],
        });
      }

      case "get_osticket_tickets": {
        const { data, error } = await supabase
          .from("osticket_tickets")
          .select("id, ticket_number, subject, customer_name, priority, department, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(args.limit || 20);
        
        if (error) throw error;
        
        return JSON.stringify({
          tickets: data?.map((t: any) => ({
            numero: t.ticket_number,
            asunto: t.subject,
            cliente: t.customer_name,
            prioridad: t.priority,
            departamento: t.department,
            fecha: new Date(t.created_at).toLocaleDateString("es-ES"),
          })) || [],
        });
      }
      
      default:
        return JSON.stringify({ error: `Herramienta desconocida: ${toolName}` });
    }
  } catch (err: any) {
    console.error(`Tool error (${toolName}):`, err);
    return JSON.stringify({ error: err.message });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error("Messages array is required");
    }

    const systemPrompt = `Eres un asistente de CRM inteligente con acceso COMPLETO a toda la aplicación. Puedes:

**GESTIÓN DE LEADS:**
- Buscar, crear, actualizar y eliminar leads
- Ver estadísticas y métricas de leads
- Organizar leads por carpetas

**RECORDATORIOS Y TAREAS:**
- Ver y crear recordatorios generales
- Ver recordatorios de seguimiento de leads
- Marcar recordatorios como completados

**COMUNICACIÓN:**
- Enviar mensajes internos a otros usuarios del equipo
- Ver mensajes no leídos
- Ver conversaciones de WhatsApp y sus mensajes
- Gestionar plantillas de mensajes

**ARCHIVOS Y DOCUMENTOS:**
- Ver archivos compartidos
- Organizar por carpetas
- Ver plantillas de email

**CAMPAÑAS:**
- Ver campañas de email y sus estadísticas

**SOPORTE:**
- Ver tickets de osTicket

**AUDITORÍA:**
- Ver registro de acciones del sistema

Responde siempre en español de forma concisa y útil. Cuando el usuario pregunte algo, usa las herramientas apropiadas para obtener la información real del sistema.
Si necesitas buscar un lead o información específica, siempre usa las herramientas disponibles en lugar de inventar datos.`;

    const conversationMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // Use tools only if user is authenticated
    const canUseTools = Boolean(userId);

    const requestBody: any = {
      model: "openai/gpt-oss-120b",
      messages: conversationMessages,
      stream: true,
    };

    if (canUseTools) {
      requestBody.tools = tools;
      requestBody.tool_choice = "auto";
    }

    let response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": supabaseUrl,
        "X-Title": "Malaga Micro CRM",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de uso excedido. Por favor, intenta más tarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    // Handle tool calls - need to process the stream first
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let toolCalls: ToolCall[] = [];
    let currentToolCall: Partial<ToolCall> | null = null;

    // First pass: collect all content and tool calls
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;

        try {
          const json = JSON.parse(line.slice(6));
          const delta = json.choices?.[0]?.delta;

          if (delta?.content) {
            fullContent += delta.content;
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = {
                    id: tc.id || "",
                    type: "function",
                    function: { name: "", arguments: "" },
                  };
                }
                if (tc.id) toolCalls[tc.index].id = tc.id;
                if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name;
                if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
              }
            }
          }
        } catch {}
      }
    }

    // If there are tool calls, execute them and get a new response
    if (toolCalls.length > 0 && userId) {
      const toolResults: ChatMessage[] = [];

      for (const tc of toolCalls) {
        if (!tc.function.name) continue;
        
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {}

        const result = await executeToolCall(supabase, userId, tc.function.name, args);
        toolResults.push({
          role: "tool",
          content: result,
          tool_call_id: tc.id,
        });
      }

      // Make a follow-up request with tool results
      const followUpMessages = [
        ...conversationMessages,
        {
          role: "assistant" as const,
          content: fullContent || null,
          tool_calls: toolCalls,
        },
        ...toolResults,
      ];

      const followUpResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": supabaseUrl,
          "X-Title": "Malaga Micro CRM",
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: followUpMessages,
          stream: true,
        }),
      });

      if (!followUpResponse.ok) {
        throw new Error("Follow-up request failed");
      }

      return new Response(followUpResponse.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // If no tool calls, stream the original response
    // We need to recreate the stream since we consumed it
    const newResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": supabaseUrl,
        "X-Title": "Malaga Micro CRM",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: conversationMessages,
        stream: true,
      }),
    });

    return new Response(newResponse.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (err: any) {
    console.error("Chat error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
