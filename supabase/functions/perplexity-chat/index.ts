import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

// Helper: upload base64 image to Supabase storage and return public URL
async function uploadBase64ToStorage(supabase: any, dataUrl: string, supabaseUrl: string): Promise<string | null> {
  try {
    // Parse data URL: data:image/png;base64,iVBOR...
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    
    const mimeType = match[1];
    const base64Data = match[2];
    const ext = mimeType.split('/')[1] || 'png';
    const fileName = `ai-gen/${crypto.randomUUID()}.${ext}`;
    
    // Decode base64 to Uint8Array
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    
    const { error } = await supabase.storage
      .from('chat-files')
      .upload(fileName, bytes, { contentType: mimeType, upsert: false });
    
    if (error) {
      console.error('Storage upload error:', error);
      return null;
    }
    
    return `${supabaseUrl}/storage/v1/object/public/chat-files/${fileName}`;
  } catch (e) {
    console.error('Base64 upload error:', e);
    return null;
  }
}

const STEL_API_BASE = 'https://app.stelorder.com/app';

const tools = [
  // Lead Management
  {
    type: "function",
    function: {
      name: "search_leads",
      description: "Buscar leads por nombre de empresa, contacto, teléfono, email o ciudad.",
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
      description: "Obtener todos los leads del usuario con filtros opcionales.",
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
      description: "Obtener estadísticas generales de leads: total, por estado, tasa de conversión.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Crear un nuevo lead.",
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
      description: "Actualizar un lead existente.",
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
      description: "Eliminar un lead.",
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
      description: "Obtener actividades recientes del CRM.",
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
      description: "Obtener recordatorios pendientes de leads.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_general_reminders",
      description: "Obtener recordatorios generales.",
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
      description: "Crear un nuevo recordatorio general.",
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
      description: "Enviar un mensaje interno a otro usuario del sistema.",
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
      description: "Obtener lista de usuarios del equipo disponibles para mensajería.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_unread_messages",
      description: "Obtener mensajes internos no leídos del usuario.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  // Templates
  {
    type: "function",
    function: {
      name: "get_message_templates",
      description: "Obtener plantillas de mensajes guardadas.",
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
          category: { type: "string", description: "Categoría" },
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
      description: "Obtener archivos compartidos del usuario.",
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
      parameters: { type: "object", properties: {}, required: [] },
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
      parameters: { type: "object", properties: {}, required: [] },
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
      parameters: { type: "object", properties: {}, required: [] },
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
          entity_type: { type: "string", description: "Filtrar por tipo de entidad" },
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
  // Calendar
  {
    type: "function",
    function: {
      name: "get_calendar_events",
      description: "Ver los eventos del calendario del usuario. Puede filtrar por rango de fechas.",
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
      description: "Crear un nuevo evento en el calendario.",
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
        },
        required: ["title", "event_date", "start_time"],
      },
    },
  },
  // Calendar: Share event with participants
  {
    type: "function",
    function: {
      name: "share_calendar_event",
      description: "Compartir un evento del calendario con otros usuarios del equipo. Puedes asignar permisos de solo ver o editar.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string", description: "ID del evento a compartir" },
          participant_names: { 
            type: "array", 
            items: { type: "string" },
            description: "Nombres de los usuarios con quienes compartir el evento" 
          },
          permission: { type: "string", enum: ["view", "edit"], description: "Permiso: 'view' (solo ver) o 'edit' (editar). Default: 'view'" },
        },
        required: ["event_id", "participant_names"],
      },
    },
  },
  // ===== STEL ORDER BUDGETS =====
  {
    type: "function",
    function: {
      name: "stel_list_budgets",
      description: "Listar presupuestos de STEL Order. Muestra presupuestos existentes con su número, cliente, total y estado.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Texto de búsqueda para filtrar presupuestos" },
          page: { type: "string", description: "Página (default 1)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stel_get_budget",
      description: "Obtener detalle completo de un presupuesto de STEL Order por su ID, incluyendo líneas de productos, cliente y totales.",
      parameters: {
        type: "object",
        properties: {
          budget_id: { type: "string", description: "ID del presupuesto en STEL Order" },
        },
        required: ["budget_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stel_create_budget",
      description: "Crear un nuevo presupuesto en STEL Order. Necesitas al menos un cliente (nombre o ID) y las líneas de productos.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "Nombre del cliente (se buscará o creará en STEL)" },
          client_id: { type: "number", description: "ID del cliente si ya se conoce" },
          client_email: { type: "string", description: "Email del cliente (para crear nuevo)" },
          subject: { type: "string", description: "Asunto/título del presupuesto" },
          notes: { type: "string", description: "Notas del presupuesto" },
          valid_until: { type: "string", description: "Fecha de validez (formato ISO)" },
          items: {
            type: "array",
            description: "Líneas del presupuesto",
            items: {
              type: "object",
              properties: {
                concept: { type: "string", description: "Concepto/nombre del producto" },
                quantity: { type: "number", description: "Cantidad (default 1)" },
                price: { type: "number", description: "Precio unitario" },
                taxPercentage: { type: "number", description: "% IVA (default 21)" },
                discount: { type: "number", description: "% descuento (default 0)" },
              },
              required: ["concept", "price"],
            },
          },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stel_update_budget",
      description: "Actualizar un presupuesto existente en STEL Order.",
      parameters: {
        type: "object",
        properties: {
          budget_id: { type: "string", description: "ID del presupuesto" },
          subject: { type: "string", description: "Nuevo asunto" },
          notes: { type: "string", description: "Nuevas notas" },
          lines: {
            type: "array",
            description: "Nuevas líneas del presupuesto",
            items: {
              type: "object",
              properties: {
                concept: { type: "string" },
                quantity: { type: "number" },
                price: { type: "number" },
                taxPercentage: { type: "number" },
                discount: { type: "number" },
              },
              required: ["concept", "price"],
            },
          },
        },
        required: ["budget_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stel_delete_budget",
      description: "Eliminar un presupuesto de STEL Order.",
      parameters: {
        type: "object",
        properties: {
          budget_id: { type: "string", description: "ID del presupuesto a eliminar" },
        },
        required: ["budget_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stel_convert_to_invoice",
      description: "Convertir un presupuesto de STEL Order en factura.",
      parameters: {
        type: "object",
        properties: {
          budget_id: { type: "string", description: "ID del presupuesto a convertir en factura" },
        },
        required: ["budget_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stel_convert_to_order",
      description: "Convertir un presupuesto de STEL Order en pedido.",
      parameters: {
        type: "object",
        properties: {
          budget_id: { type: "string", description: "ID del presupuesto a convertir en pedido" },
        },
        required: ["budget_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stel_list_clients",
      description: "Listar clientes de STEL Order. Usa esto para buscar clientes existentes antes de crear un presupuesto.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Texto de búsqueda para filtrar clientes" },
        },
        required: [],
      },
    },
  },
  // View shared file content/URL
  {
    type: "function",
    function: {
      name: "view_shared_file",
      description: "Ver un archivo compartido. Para imágenes devuelve la URL pública. Para texto devuelve el contenido. Úsalo cuando el usuario pregunte por una imagen, logo o archivo del sistema.",
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
  // AI Memory tools
  {
    type: "function",
    function: {
      name: "get_ai_memories",
      description: "Consultar los recuerdos/contexto almacenados en la Memoria IA sobre un lead o del usuario general.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID del lead para buscar recuerdos específicos (opcional)" },
          category: { type: "string", description: "Categoría: general, preference, interaction, note, document, image (opcional)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_ai_memory_file",
      description: "Leer el contenido de un archivo almacenado en la Memoria IA. Soporta TODOS los formatos: PDF, DOCX, Excel, imágenes, texto, CSV, etc. El texto de documentos binarios se extrae automáticamente al subirse. Busca por nombre de archivo o clave. Para imágenes devuelve la URL pública. Para documentos devuelve el contenido textual completo.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Nombre del archivo o clave de memoria a buscar" },
          memory_id: { type: "string", description: "ID específico de la memoria si se conoce" },
        },
        required: [],
      },
    },
  },
  // Subagent delegation (single or chained)
  {
    type: "function",
    function: {
      name: "delegate_to_subagent",
      description: "Delegar una tarea a un subagente especializado. Puedes llamar esta herramienta VARIAS VECES en paralelo para usar múltiples subagentes. Si necesitas encadenar (output de uno como input de otro), usa el campo 'depends_on' con el nombre del agente cuyo resultado necesitas.",
      parameters: {
        type: "object",
        properties: {
          agent_name: { type: "string", description: "Nombre exacto del subagente al que delegar" },
          task_description: { type: "string", description: "Descripción clara de la tarea a realizar por el subagente" },
          depends_on: { type: "string", description: "Nombre del subagente cuyo resultado se necesita antes de ejecutar este. Si se indica, el output del agente previo se añade al task_description automáticamente." },
        },
        required: ["agent_name", "task_description"],
      },
    },
  },
];

// Map endpoint paths to their required root JSON key for POST/PUT
const STEL_ROOT_KEY_MAP: Record<string, string> = {
  'salesEstimates': 'est_quote',
  'ordinaryInvoices': 'est_ordinary_invoice',
  'salesOrders': 'est_sales_order',
  'clients': 'client',
  'contacts': 'contact',
  'products': 'product',
  'services': 'service',
  'suppliers': 'supplier',
  'potentialClients': 'potential_client',
};

function getStelRootKey(endpoint: string): string | null {
  for (const [path, key] of Object.entries(STEL_ROOT_KEY_MAP)) {
    if (endpoint.startsWith(path)) return key;
  }
  return null;
}

// Helper to call STEL Order API
async function callStelApi(endpoint: string, method = 'GET', payload?: any): Promise<any> {
  const apiKey = Deno.env.get('STELORDER_API_KEY');
  if (!apiKey) throw new Error('STELORDER_API_KEY not configured');

  const headers: Record<string, string> = {
    'APIKEY': apiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const sep = endpoint.includes('?') ? '&' : '?';
  const fullUrl = `${STEL_API_BASE}/${endpoint}${sep}APIKEY=${encodeURIComponent(apiKey)}`;

  const opts: RequestInit = { method, headers };
  if (payload && (method === 'POST' || method === 'PUT')) {
    // Wrap payload in root key as required by STEL Order API
    const rootKey = getStelRootKey(endpoint);
    const wrappedPayload = rootKey ? { [rootKey]: payload } : payload;
    console.log('[STEL AI] Payload:', JSON.stringify(wrappedPayload));
    opts.body = JSON.stringify(wrappedPayload);
  }

  const res = await fetch(fullUrl, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) console.error('[STEL AI] Error ' + res.status + ':', JSON.stringify(data));
  return { ok: res.ok, status: res.status, data };
}

async function executeToolCall(
  supabase: any,
  userId: string,
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  try {
    switch (toolName) {
      // ===== STEL ORDER TOOLS =====
      case "stel_list_budgets": {
        const search = args.search || '';
        const page = args.page || '1';
        let endpoint = `salesEstimates?limit=20&page=${page}`;
        if (search && search.trim()) endpoint += `&search=${encodeURIComponent(search)}`;
        
        const result = await callStelApi(endpoint);
        if (!result.ok) return JSON.stringify({ error: 'Error al listar presupuestos STEL', details: result.data });
        
        const budgets = Array.isArray(result.data) ? result.data : [];
        return JSON.stringify({
          message: `Encontrados ${budgets.length} presupuestos en STEL Order`,
          presupuestos: budgets.map((b: any) => ({
            id: b.id,
            numero: b.number || b.serialNumber,
            cliente: b.client?.name || b.clientName || 'Sin cliente',
            asunto: b.subject || '',
            total: b.total || b.totalWithTax || 0,
            fecha: b.date || b.createdAt,
            estado: b.status || 'draft',
          })),
        });
      }

      case "stel_get_budget": {
        const result = await callStelApi(`salesEstimates/${args.budget_id}`);
        if (!result.ok) return JSON.stringify({ error: 'Presupuesto no encontrado', details: result.data });
        
        const b = result.data;
        return JSON.stringify({
          presupuesto: {
            id: b.id,
            numero: b.number || b.serialNumber,
            cliente: b.client?.name || b.clientName,
            cliente_email: b.client?.email,
            asunto: b.subject,
            notas: b.notes,
            lineas: (b.lines || []).map((l: any) => ({
              concepto: l.concept || l.description,
              cantidad: l.quantity,
              precio: l.price || l.unitPrice,
              iva: l.taxPercentage,
              descuento: l.discount,
              total: l.total || (l.quantity * (l.price || l.unitPrice || 0)),
            })),
            subtotal: b.subtotal || b.total,
            total_con_iva: b.totalWithTax || b.total,
            fecha: b.date || b.createdAt,
            validez: b.validUntil,
          },
        });
      }

      case "stel_create_budget": {
        let clientId = args.client_id;
        
        // Search or create client if name provided
        if (!clientId && args.client_name) {
          const searchResult = await callStelApi(`clients?search=${encodeURIComponent(args.client_name)}`);
          if (searchResult.ok && Array.isArray(searchResult.data) && searchResult.data.length > 0) {
            clientId = searchResult.data[0].id;
          } else {
            const createResult = await callStelApi('clients', 'POST', {
              name: args.client_name,
              email: args.client_email || '',
              commercialName: args.client_name,
            });
            if (createResult.ok) clientId = createResult.data.id;
          }
        }

        const budgetPayload: any = {
          clientId: clientId,
          lines: (args.items || []).map((item: any) => ({
            concept: item.concept || 'Producto',
            quantity: item.quantity || 1,
            price: item.price || 0,
            taxPercentage: item.taxPercentage || 21,
            discount: item.discount || 0,
          })),
          notes: args.notes || '',
        };

        if (args.subject) budgetPayload.subject = args.subject;
        if (args.valid_until) budgetPayload.validUntil = args.valid_until;

        console.log('AI creating STEL salesEstimate:', JSON.stringify(budgetPayload));
        const result = await callStelApi('salesEstimates', 'POST', budgetPayload);

        if (!result.ok) {
          return JSON.stringify({ error: 'Error al crear presupuesto en STEL', details: result.data });
        }

        return JSON.stringify({
          success: true,
          message: `Presupuesto creado en STEL Order con ID ${result.data.id}`,
          presupuesto_id: result.data.id,
          numero: result.data.number || result.data.serialNumber,
        });
      }

      case "stel_update_budget": {
        const payload: any = {};
        if (args.subject) payload.subject = args.subject;
        if (args.notes) payload.notes = args.notes;
        if (args.lines) {
          payload.lines = args.lines.map((l: any) => ({
            concept: l.concept,
            quantity: l.quantity || 1,
            price: l.price || 0,
            taxPercentage: l.taxPercentage || 21,
            discount: l.discount || 0,
          }));
        }

        const result = await callStelApi(`salesEstimates/${args.budget_id}`, 'PUT', payload);
        if (!result.ok) return JSON.stringify({ error: 'Error al actualizar presupuesto', details: result.data });

        return JSON.stringify({
          success: true,
          message: `Presupuesto ${args.budget_id} actualizado en STEL Order`,
        });
      }

      case "stel_delete_budget": {
        const result = await callStelApi(`salesEstimates/${args.budget_id}`, 'DELETE');
        if (!result.ok) return JSON.stringify({ error: 'Error al eliminar presupuesto', details: result.data });
        return JSON.stringify({ success: true, message: `Presupuesto ${args.budget_id} eliminado` });
      }

      case "stel_convert_to_invoice": {
        const budgetResult = await callStelApi(`salesEstimates/${args.budget_id}`);
        if (!budgetResult.ok) return JSON.stringify({ error: 'Presupuesto no encontrado' });

        const budget = budgetResult.data;
        const invoicePayload = {
          clientId: budget.clientId || budget.client?.id,
          lines: (budget.lines || []).map((line: any) => ({
            concept: line.concept || line.description,
            quantity: line.quantity || 1,
            price: line.price || line.unitPrice || 0,
            taxPercentage: line.taxPercentage || 21,
            discount: line.discount || 0,
          })),
          notes: `Generado desde presupuesto #${budget.number || args.budget_id}`,
        };

        const invoiceResult = await callStelApi('ordinaryInvoices', 'POST', invoicePayload);
        if (!invoiceResult.ok) return JSON.stringify({ error: 'Error al crear factura', details: invoiceResult.data });

        return JSON.stringify({
          success: true,
          message: `Factura creada desde presupuesto #${budget.number || args.budget_id}`,
          factura_id: invoiceResult.data.id,
        });
      }

      case "stel_convert_to_order": {
        const budgetResult = await callStelApi(`salesEstimates/${args.budget_id}`);
        if (!budgetResult.ok) return JSON.stringify({ error: 'Presupuesto no encontrado' });

        const budget = budgetResult.data;
        const orderPayload = {
          clientId: budget.clientId || budget.client?.id,
          lines: (budget.lines || []).map((line: any) => ({
            concept: line.concept || line.description,
            quantity: line.quantity || 1,
            price: line.price || line.unitPrice || 0,
            taxPercentage: line.taxPercentage || 21,
            discount: line.discount || 0,
          })),
          notes: `Generado desde presupuesto #${budget.number || args.budget_id}`,
        };

        const orderResult = await callStelApi('salesOrders', 'POST', orderPayload);
        if (!orderResult.ok) return JSON.stringify({ error: 'Error al crear pedido', details: orderResult.data });

        return JSON.stringify({
          success: true,
          message: `Pedido creado desde presupuesto #${budget.number || args.budget_id}`,
          pedido_id: orderResult.data.id,
        });
      }

      case "stel_list_clients": {
        const search = args.search || '';
        let endpoint = `clients?page=1&limit=20`;
        if (search && search.trim()) endpoint += `&search=${encodeURIComponent(search)}`;

        const result = await callStelApi(endpoint);
        if (!result.ok) return JSON.stringify({ error: 'Error al listar clientes STEL', details: result.data });

        const clients = Array.isArray(result.data) ? result.data : [];
        return JSON.stringify({
          clientes: clients.map((c: any) => ({
            id: c.id,
            nombre: c.name || c.commercialName,
            email: c.email,
            telefono: c.phone,
          })),
        });
      }

      // ===== CRM TOOLS =====
      case "search_leads": {
        const rawQuery = args.query?.toLowerCase() || "";
        // Escape SQL wildcards to prevent injection
        const query = rawQuery.replace(/[%_\\]/g, '\\$&').substring(0, 100);
        const limit = Math.min(args.limit || 10, 50);
        
        let queryBuilder = supabase
          .from("leads")
          .select("id, company_name, contact_name, phone, email, city, status, score, notes, created_at")
          .eq("user_id", userId)
          .or(`company_name.ilike.%${query}%,contact_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%,city.ilike.%${query}%`)
          .limit(limit);
        
        if (args.status) queryBuilder = queryBuilder.eq("status", args.status);
        
        const { data, error } = await queryBuilder;
        if (error) throw error;
        
        if (!data || data.length === 0) return JSON.stringify({ message: "No se encontraron leads", results: [] });
        
        return JSON.stringify({
          message: `Encontrados ${data.length} leads`,
          results: data.map((l: any) => ({
            id: l.id, empresa: l.company_name, contacto: l.contact_name,
            telefono: l.phone, email: l.email, ciudad: l.city,
            estado: l.status, score: l.score,
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
        
        if (args.status) queryBuilder = queryBuilder.eq("status", args.status);
        
        const { data, error } = await queryBuilder;
        if (error) throw error;
        
        return JSON.stringify({
          total: data?.length || 0,
          leads: data?.map((l: any) => ({
            id: l.id, empresa: l.company_name, contacto: l.contact_name,
            telefono: l.phone, email: l.email, ciudad: l.city,
            estado: l.status, score: l.score, segmento: l.segment, fuente: l.source,
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
          total_leads: total, por_estado: byStatus,
          leads_esta_semana: recentLeads,
          tasa_conversion: `${conversionRate}%`,
          score_promedio: avgScore,
        });
      }
      
      case "create_lead": {
        const { data, error } = await supabase
          .from("leads")
          .insert({
            user_id: userId, company_name: args.company_name,
            contact_name: args.contact_name || null, phone: args.phone || null,
            email: args.email || null, city: args.city || "Málaga",
            notes: args.notes || null, status: "nuevo",
            segment: args.segment || "pyme", source: args.source || "ia-assistant",
          })
          .select("id, company_name")
          .single();
        
        if (error) throw error;
        return JSON.stringify({ success: true, message: `Lead "${data.company_name}" creado`, lead_id: data.id });
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
          .from("leads").update(updateFields)
          .eq("id", lead_id).eq("user_id", userId)
          .select("id, company_name").single();
        
        if (error) throw error;
        return JSON.stringify({ success: true, message: `Lead "${data.company_name}" actualizado` });
      }

      case "delete_lead": {
        const { data, error } = await supabase
          .from("leads").delete()
          .eq("id", args.lead_id).eq("user_id", userId)
          .select("company_name").single();
        
        if (error) throw error;
        return JSON.stringify({ success: true, message: `Lead "${data.company_name}" eliminado` });
      }
      
      case "get_recent_activities": {
        const { data: activities, error } = await supabase
          .from("lead_activities")
          .select("id, type, description, created_at, lead_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(args.limit || 10);
        
        if (error) throw error;
        return JSON.stringify({
          actividades: activities?.map((a: any) => ({
            tipo: a.type, descripcion: a.description,
            fecha: new Date(a.created_at).toLocaleDateString("es-ES"),
          })) || [],
        });
      }
      
      case "get_pending_reminders": {
        const { data: reminders, error } = await supabase
          .from("follow_up_reminders")
          .select("id, message, reminder_date, lead_id, leads(company_name)")
          .eq("user_id", userId).eq("is_completed", false)
          .gte("reminder_date", new Date().toISOString())
          .order("reminder_date", { ascending: true }).limit(10);
        
        if (error) throw error;
        return JSON.stringify({
          recordatorios_pendientes: reminders?.map((r: any) => ({
            id: r.id, mensaje: r.message,
            fecha: new Date(r.reminder_date).toLocaleString("es-ES"),
            empresa: r.leads?.company_name,
          })) || [],
        });
      }

      case "get_general_reminders": {
        let queryBuilder = supabase
          .from("general_reminders").select("*")
          .eq("user_id", userId).order("reminder_date", { ascending: true });
        if (!args.include_completed) queryBuilder = queryBuilder.eq("is_completed", false);
        
        const { data, error } = await queryBuilder.limit(20);
        if (error) throw error;
        
        return JSON.stringify({
          recordatorios: data?.map((r: any) => ({
            id: r.id, titulo: r.title, descripcion: r.description,
            fecha: new Date(r.reminder_date).toLocaleString("es-ES"),
            prioridad: r.priority, categoria: r.category, completado: r.is_completed,
          })) || [],
        });
      }

      case "create_reminder": {
        const { data, error } = await supabase
          .from("general_reminders")
          .insert({
            user_id: userId, title: args.title,
            description: args.description || null, reminder_date: args.reminder_date,
            priority: args.priority || "medium", category: args.category || null,
          })
          .select("id, title").single();
        
        if (error) throw error;
        return JSON.stringify({ success: true, message: `Recordatorio "${data.title}" creado`, reminder_id: data.id });
      }

      case "complete_reminder": {
        const { data, error } = await supabase
          .from("general_reminders").update({ is_completed: true })
          .eq("id", args.reminder_id).eq("user_id", userId)
          .select("title").single();
        
        if (error) throw error;
        return JSON.stringify({ success: true, message: `Recordatorio "${data.title}" completado` });
      }
      
      case "get_team_users": {
        const { data: users, error } = await supabase
          .from("profiles").select("user_id, full_name, avatar_url")
          .neq("user_id", userId);
        
        if (error) throw error;
        return JSON.stringify({
          usuarios: users?.map((u: any) => ({
            id: u.user_id, nombre: u.full_name || "Usuario sin nombre", avatar: u.avatar_url,
          })) || [],
        });
      }
      
      case "send_internal_message": {
        const { recipient_name, message } = args;
        
        const { data: recipients, error: recipientError } = await supabase
          .from("profiles").select("user_id, full_name")
          .ilike("full_name", `%${recipient_name}%`).limit(1);
        
        if (recipientError) throw recipientError;
        if (!recipients || recipients.length === 0) {
          return JSON.stringify({ success: false, error: `No se encontró usuario "${recipient_name}"` });
        }
        
        const recipientId = recipients[0].user_id;
        const recipientFullName = recipients[0].full_name;
        
        const { data: existingParticipations } = await supabase
          .from("conversation_participants").select("conversation_id").eq("user_id", userId);
        
        let conversationId: string | null = null;
        
        if (existingParticipations && existingParticipations.length > 0) {
          const convIds = existingParticipations.map((p: any) => p.conversation_id);
          const { data: conversations } = await supabase
            .from("internal_conversations").select("id").in("id", convIds).eq("is_group", false);
          
          if (conversations) {
            for (const conv of conversations) {
              const { data: participants } = await supabase
                .from("conversation_participants").select("user_id").eq("conversation_id", conv.id);
              const participantIds = participants?.map((p: any) => p.user_id) || [];
              if (participantIds.includes(recipientId) && participantIds.length === 2) {
                conversationId = conv.id;
                break;
              }
            }
          }
        }
        
        if (!conversationId) {
          const { data: newConv, error: convError } = await supabase
            .from("internal_conversations").insert({ is_group: false, created_by: userId })
            .select("id").single();
          if (convError) throw convError;
          conversationId = newConv.id;
          
          await supabase.from("conversation_participants").insert([
            { conversation_id: conversationId, user_id: userId, is_admin: true },
            { conversation_id: conversationId, user_id: recipientId, is_admin: false },
          ]);
        }
        
        const { error: msgError } = await supabase
          .from("internal_messages").insert({
            conversation_id: conversationId, sender_id: userId,
            content: message, message_type: "text",
          });
        if (msgError) throw msgError;
        
        await supabase.from("internal_conversations")
          .update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
        
        return JSON.stringify({
          success: true,
          message: `Mensaje enviado a ${recipientFullName}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
        });
      }

      case "get_unread_messages": {
        const { data: participations, error: partError } = await supabase
          .from("conversation_participants").select("conversation_id, last_read_at").eq("user_id", userId);
        if (partError) throw partError;
        
        let unreadCount = 0;
        const unreadChats: any[] = [];
        
        for (const part of participations || []) {
          const { data: messages } = await supabase
            .from("internal_messages").select("id, content, sender_id, created_at")
            .eq("conversation_id", part.conversation_id).neq("sender_id", userId)
            .gt("created_at", part.last_read_at || "1970-01-01")
            .order("created_at", { ascending: false }).limit(5);
          
          if (messages && messages.length > 0) {
            unreadCount += messages.length;
            unreadChats.push({
              conversation_id: part.conversation_id,
              mensajes_sin_leer: messages.length,
              ultimo_mensaje: messages[0].content?.substring(0, 50),
            });
          }
        }
        
        return JSON.stringify({ total_sin_leer: unreadCount, conversaciones: unreadChats });
      }

      case "get_message_templates": {
        let queryBuilder = supabase
          .from("message_templates").select("id, name, content, category, created_at")
          .eq("user_id", userId).order("created_at", { ascending: false });
        if (args.category) queryBuilder = queryBuilder.eq("category", args.category);
        
        const { data, error } = await queryBuilder.limit(20);
        if (error) throw error;
        
        return JSON.stringify({
          plantillas: data?.map((t: any) => ({
            id: t.id, nombre: t.name, contenido: t.content.substring(0, 100), categoria: t.category,
          })) || [],
        });
      }

      case "create_message_template": {
        const { data, error } = await supabase
          .from("message_templates")
          .insert({ user_id: userId, name: args.name, content: args.content, category: args.category || "general" })
          .select("id, name").single();
        if (error) throw error;
        return JSON.stringify({ success: true, message: `Plantilla "${data.name}" creada`, template_id: data.id });
      }

      case "get_shared_files": {
        let queryBuilder = supabase
          .from("shared_files").select("id, file_name, file_type, file_size, description, created_at, folder_id")
          .eq("user_id", userId).order("created_at", { ascending: false });
        if (args.folder_id) queryBuilder = queryBuilder.eq("folder_id", args.folder_id);
        
        const { data, error } = await queryBuilder.limit(args.limit || 20);
        if (error) throw error;
        
        return JSON.stringify({
          archivos: data?.map((f: any) => ({
            id: f.id, nombre: f.file_name, tipo: f.file_type,
            tamaño: `${(f.file_size / 1024).toFixed(1)} KB`, descripcion: f.description,
            fecha: new Date(f.created_at).toLocaleDateString("es-ES"),
          })) || [],
        });
      }

      case "get_shared_folders": {
        const { data, error } = await supabase
          .from("shared_folders").select("id, name, color, parent_id, created_at")
          .eq("user_id", userId).order("name");
        if (error) throw error;
        return JSON.stringify({
          carpetas: data?.map((f: any) => ({ id: f.id, nombre: f.name, color: f.color })) || [],
        });
      }

      case "get_email_campaigns": {
        let queryBuilder = supabase
          .from("email_campaigns")
          .select("id, name, status, total_recipients, total_sent, total_opened, sent_at, created_at")
          .eq("user_id", userId).order("created_at", { ascending: false });
        if (args.status) queryBuilder = queryBuilder.eq("status", args.status);
        
        const { data, error } = await queryBuilder.limit(10);
        if (error) throw error;
        
        return JSON.stringify({
          campañas: data?.map((c: any) => ({
            id: c.id, nombre: c.name, estado: c.status,
            destinatarios: c.total_recipients, enviados: c.total_sent, abiertos: c.total_opened,
            fecha_envio: c.sent_at ? new Date(c.sent_at).toLocaleDateString("es-ES") : null,
          })) || [],
        });
      }

      case "get_email_templates": {
        const { data, error } = await supabase
          .from("email_templates").select("id, name, subject, is_active, created_at")
          .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
        if (error) throw error;
        return JSON.stringify({
          plantillas_email: data?.map((t: any) => ({
            id: t.id, nombre: t.name, asunto: t.subject, activa: t.is_active,
          })) || [],
        });
      }

      case "get_whatsapp_chats": {
        const { data, error } = await supabase
          .from("whatsapp_chats").select("id, chat_id, phone, custom_name, unread_count, last_message_at")
          .eq("user_id", userId).eq("is_archived", false)
          .order("last_message_at", { ascending: false }).limit(args.limit || 20);
        if (error) throw error;
        return JSON.stringify({
          chats_whatsapp: data?.map((c: any) => ({
            id: c.id, chat_id: c.chat_id, telefono: c.phone, nombre: c.custom_name,
            sin_leer: c.unread_count,
            ultimo_mensaje: c.last_message_at ? new Date(c.last_message_at).toLocaleString("es-ES") : null,
          })) || [],
        });
      }

      case "get_whatsapp_messages": {
        const { data, error } = await supabase
          .from("waha_messages").select("id, content, from_me, timestamp, message_type")
          .eq("user_id", userId).eq("chat_id", args.chat_id)
          .order("timestamp", { ascending: false }).limit(args.limit || 20);
        if (error) throw error;
        return JSON.stringify({
          mensajes: data?.map((m: any) => ({
            id: m.id, contenido: m.content?.substring(0, 200), enviado: m.from_me,
            fecha: new Date(m.timestamp).toLocaleString("es-ES"), tipo: m.message_type,
          })) || [],
        });
      }

      case "get_lead_folders": {
        const { data, error } = await supabase
          .from("lead_folders").select("id, name, color").eq("user_id", userId).order("name");
        if (error) throw error;
        return JSON.stringify({
          carpetas_leads: data?.map((f: any) => ({ id: f.id, nombre: f.name, color: f.color })) || [],
        });
      }

      case "get_audit_logs": {
        let queryBuilder = supabase
          .from("audit_logs").select("id, action, entity_type, entity_id, details, created_at")
          .eq("user_id", userId).order("created_at", { ascending: false });
        if (args.entity_type) queryBuilder = queryBuilder.eq("entity_type", args.entity_type);
        
        const { data, error } = await queryBuilder.limit(args.limit || 20);
        if (error) throw error;
        return JSON.stringify({
          registros: data?.map((l: any) => ({
            accion: l.action, tipo: l.entity_type, detalles: l.details,
            fecha: new Date(l.created_at).toLocaleString("es-ES"),
          })) || [],
        });
      }

      case "get_osticket_tickets": {
        const { data, error } = await supabase
          .from("osticket_tickets")
          .select("id, ticket_number, subject, customer_name, priority, department, created_at")
          .eq("user_id", userId).order("created_at", { ascending: false }).limit(args.limit || 20);
        if (error) throw error;
        return JSON.stringify({
          tickets: data?.map((t: any) => ({
            numero: t.ticket_number, asunto: t.subject, cliente: t.customer_name,
            prioridad: t.priority, departamento: t.department,
            fecha: new Date(t.created_at).toLocaleDateString("es-ES"),
          })) || [],
        });
      }
      
      case "get_calendar_events": {
        const today = new Date();
        const fromDate = args.from_date || today.toISOString().split('T')[0];
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + 30);
        const toDate = args.to_date || futureDate.toISOString().split('T')[0];
        const limit = Math.min(args.limit || 10, 50);

        const { data, error } = await supabase
          .from("calendar_events")
          .select("id, title, description, event_date, start_time, end_time, all_day, color, reminder_minutes")
          .eq("creator_id", userId)
          .gte("event_date", fromDate)
          .lte("event_date", toDate)
          .order("event_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(limit);

        if (error) throw error;

        return JSON.stringify({
          message: `${data?.length || 0} evento(s) encontrado(s)`,
          eventos: data?.map((e: any) => ({
            id: e.id,
            titulo: e.title,
            descripcion: e.description || "-",
            fecha: e.event_date,
            hora_inicio: e.start_time,
            hora_fin: e.end_time || "-",
            todo_el_dia: e.all_day,
            color: e.color,
          })) || [],
        });
      }

      case "create_calendar_event": {
        const title = args.title;
        const eventDate = args.event_date;
        const startTime = args.start_time || "09:00";

        if (!title || !eventDate) {
          return JSON.stringify({ success: false, error: "Faltan parámetros: title y event_date son obligatorios." });
        }

        const { data, error } = await supabase
          .from("calendar_events")
          .insert({
            creator_id: userId,
            title,
            event_date: eventDate,
            start_time: startTime,
            end_time: args.end_time || null,
            description: args.description || null,
            all_day: args.all_day || false,
            color: args.color || "#3b82f6",
            reminder_minutes: args.reminder_minutes ?? 15,
          })
          .select("id, title, event_date, start_time")
          .single();

        if (error) throw error;
        return JSON.stringify({
          success: true,
          message: `Evento "${data.title}" creado para el ${data.event_date} a las ${data.start_time}`,
          event_id: data.id,
        });
      }

      case "share_calendar_event": {
        const { event_id, participant_names, permission = "view" } = args;

        // Verify the event belongs to the user
        const { data: eventData, error: eventError } = await supabase
          .from("calendar_events")
          .select("id, title")
          .eq("id", event_id)
          .eq("creator_id", userId)
          .single();

        if (eventError || !eventData) {
          return JSON.stringify({ success: false, error: "Evento no encontrado o no tienes permisos para compartirlo." });
        }

        const sharedWith: string[] = [];
        const errors: string[] = [];

        for (const name of participant_names) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .ilike("full_name", `%${name}%`)
            .limit(1);

          if (!profiles || profiles.length === 0) {
            errors.push(`No se encontró usuario "${name}"`);
            continue;
          }

          const participantUserId = profiles[0].user_id;

          // Check if already a participant
          const { data: existing } = await supabase
            .from("event_participants")
            .select("id")
            .eq("event_id", event_id)
            .eq("user_id", participantUserId)
            .maybeSingle();

          if (existing) {
            // Update permission
            await supabase
              .from("event_participants")
              .update({ permission })
              .eq("id", existing.id);
            sharedWith.push(profiles[0].full_name);
          } else {
            const { error: insertError } = await supabase
              .from("event_participants")
              .insert({
                event_id,
                user_id: participantUserId,
                permission,
              });

            if (insertError) {
              errors.push(`Error al compartir con ${profiles[0].full_name}: ${insertError.message}`);
            } else {
              sharedWith.push(profiles[0].full_name);
            }
          }
        }

        const resultMsg = [];
        if (sharedWith.length > 0) {
          resultMsg.push(`Evento "${eventData.title}" compartido con: ${sharedWith.join(", ")} (permiso: ${permission})`);
        }
        if (errors.length > 0) {
          resultMsg.push(`Errores: ${errors.join("; ")}`);
        }

        return JSON.stringify({
          success: sharedWith.length > 0,
          message: resultMsg.join(". "),
          shared_with: sharedWith,
        });
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
        
        const formatBytes = (b: number) => {
          if (!b) return "0 B";
          const k = 1024;
          const s = ["B", "KB", "MB", "GB"];
          const i = Math.floor(Math.log(b) / Math.log(k));
          return parseFloat((b / Math.pow(k, i)).toFixed(1)) + " " + s[i];
        };
        
        return JSON.stringify({
          file: { nombre: files.file_name, tipo: files.file_type, tamaño: formatBytes(files.file_size), url: publicUrl, descripcion: files.description },
          is_image: isImage,
          message: isImage ? "Usa la URL para ver/describir la imagen" : "Archivo disponible en la URL",
        });
      }

      case "get_ai_memories": {
        const leadId = args.lead_id ? String(args.lead_id) : null;
        const cat = args.category ? String(args.category) : null;
        let memQuery = supabase.from("ai_memory").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(30);
        if (leadId) memQuery = memQuery.eq("lead_id", leadId);
        if (cat) memQuery = memQuery.eq("category", cat);
        const { data: memData, error: memErr } = await memQuery;
        if (memErr) throw memErr;
        if (!memData?.length) return JSON.stringify({ message: "No hay recuerdos almacenados." });
        return JSON.stringify({
          message: `${memData.length} recuerdo(s) encontrados`,
          memories: memData.map((m: any) => ({ id: m.id, key: m.memory_key, value: m.memory_value, category: m.category, lead_id: m.lead_id, updated: m.updated_at })),
        });
      }

      case "view_ai_memory_file": {
        const searchTerm = String(args.search || "");
        const memoryId = String(args.memory_id || "");
        
        let memFileQuery = supabase.from("ai_memory").select("*").eq("user_id", userId);
        if (memoryId) {
          memFileQuery = memFileQuery.eq("id", memoryId);
        } else if (searchTerm) {
          memFileQuery = memFileQuery.or(`memory_key.ilike.%${searchTerm}%,category.in.(image,document)`);
        } else {
          return JSON.stringify({ error: "Necesitas indicar search o memory_id" });
        }
        
        const { data: memFiles2, error: memErr2 } = await memFileQuery.limit(10);
        if (memErr2) throw memErr2;
        
        const fileMemories = (memFiles2 || []).filter((m: any) => {
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
          const { data: allMem2 } = await supabase.from("ai_memory").select("*").eq("user_id", userId)
            .in("category", ["image", "document"]).limit(20);
          const matches = (allMem2 || []).filter((m: any) => {
            if (!searchTerm) return true;
            const s = searchTerm.toLowerCase();
            return m.memory_key.toLowerCase().includes(s) || 
              (m.memory_value?.file_name && m.memory_value.file_name.toLowerCase().includes(s));
          });
          if (!matches.length) return JSON.stringify({ error: "No se encontró ningún archivo en la memoria IA con ese nombre" });
          
          const results = matches.map((m: any) => ({
            id: m.id, key: m.memory_key, category: m.category,
            file_name: m.memory_value.file_name, file_url: m.memory_value.file_url,
            has_content: !!m.memory_value.content,
            content_preview: m.memory_value.content ? m.memory_value.content.substring(0, 5000) : undefined,
          }));
          return JSON.stringify({ message: `${results.length} archivo(s) encontrados en memoria IA`, files: results });
        }
        
        const results2 = await Promise.all(fileMemories.map(async (m: any) => {
          const val = m.memory_value;
          const result: any = { id: m.id, key: m.memory_key, category: m.category, file_name: val.file_name, file_type: val.file_type };
          
          if (val.file_url) {
            result.file_url = val.file_url;
            const isImg = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(val.file_name || '') || (val.file_type && val.file_type.startsWith('image/'));
            result.is_image = isImg;
            if (!isImg) {
              try { const r = await fetch(val.file_url); result.content = (await r.text()).substring(0, 20000); } catch {}
            }
          }
          if (val.content) result.content = val.content.substring(0, 20000);
          return result;
        }));
        
        return JSON.stringify({ message: `${results2.length} archivo(s) de memoria IA`, files: results2 });
      }

      case "delegate_to_subagent": {
        const agentName = args.agent_name;
        const taskDescription = args.task_description;
        return JSON.stringify({ 
          delegation_requested: true, 
          agent_name: agentName, 
          task: taskDescription,
          message: `🔄 Delegando tarea a **${agentName}**: ${taskDescription}` 
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

    const { messages, model: requestedModel, subagents: clientSubagents, delegateToSubagent } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error("Messages array is required");
    }

    // --- Subagent delegation mode ---
    if (delegateToSubagent) {
      const { agentName, agentModel, agentPrompt, agentType, agentTools, userMessage } = delegateToSubagent;
      console.log(`[perplexity-chat] Delegating to subagent: ${agentName} (${agentModel}), tools: ${JSON.stringify(agentTools || [])}`);

      // Filter tools to only those assigned to this subagent
      const allowedTools = Array.isArray(agentTools) && agentTools.length > 0
        ? tools.filter(t => agentTools.includes(t.function.name))
        : [];

      if (agentType === 'image') {
        // Image generation via OpenRouter
        const imageModel = agentModel || 'google/gemini-2.5-flash-image-preview';
        
        // Gemini image models need modalities param; FLUX and others don't
        const isGeminiImageModel = imageModel.includes('gemini') && imageModel.includes('image');
        
        const buildImageRequest = (model: string, useModalities: boolean) => {
          const body: any = {
            model,
            messages: [
              { role: "user", content: agentPrompt ? `${agentPrompt}\n\nGenera una imagen de: ${userMessage}` : `Generate an image of: ${userMessage}` },
            ],
            stream: false,
          };
          if (useModalities) body.modalities = ["image", "text"];
          return body;
        };
        
        const callImageApi = async (body: any) => {
          return await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": supabaseUrl,
              "X-Title": "Malaga Micro CRM - Image Subagent",
            },
            body: JSON.stringify(body),
          });
        };
        
        console.log(`[perplexity-chat] Image gen: model=${imageModel}, gemini=${isGeminiImageModel}`);
        
        let imageResponse = await callImageApi(buildImageRequest(imageModel, isGeminiImageModel));
        
        // If the configured model fails (404 or modalities error), fallback to gemini image model
        if (!imageResponse.ok) {
          const errText = await imageResponse.text();
          console.warn(`[perplexity-chat] Image model ${imageModel} failed (${imageResponse.status}): ${errText}`);
          
          if (imageModel !== 'google/gemini-2.5-flash-image-preview') {
            console.log(`[perplexity-chat] Trying fallback: google/gemini-2.5-flash-image-preview`);
            imageResponse = await callImageApi(buildImageRequest('google/gemini-2.5-flash-image-preview', true));
            
            if (!imageResponse.ok) {
              const fbErr = await imageResponse.text();
              console.error(`[perplexity-chat] Fallback also failed: ${fbErr}`);
              return new Response(JSON.stringify({ error: `Error generando imagen. Modelo ${imageModel} y fallback fallaron.` }), {
                status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          } else {
            return new Response(JSON.stringify({ error: `Error del subagente ${agentName}: ${imageResponse.status} - ${errText}` }), {
              status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        const imageData = await imageResponse.json();
        console.log('[perplexity-chat] Image response keys:', JSON.stringify(Object.keys(imageData)));
        const messageData = imageData.choices?.[0]?.message;
        console.log('[perplexity-chat] Message data:', messageData ? JSON.stringify(Object.keys(messageData)) : 'null');
        
        // Extract images from response
        const uploadedUrls: string[] = [];
        
        // OpenRouter returns images in message.images array
        if (Array.isArray(messageData?.images)) {
          console.log('[perplexity-chat] Found images array:', messageData.images.length);
          for (const img of messageData.images) {
            const imgUrl = img.image_url?.url || img.url || (typeof img === 'string' ? img : null);
            if (imgUrl?.startsWith('data:')) {
              const url = await uploadBase64ToStorage(supabase, imgUrl, supabaseUrl);
              if (url) uploadedUrls.push(url);
            } else if (imgUrl) {
              uploadedUrls.push(imgUrl);
            }
          }
        }
        
        // Also check content array for multimodal responses
        if (Array.isArray(messageData?.content)) {
          for (const part of messageData.content) {
            if (part.type === 'image_url' && part.image_url?.url?.startsWith('data:')) {
              const url = await uploadBase64ToStorage(supabase, part.image_url.url, supabaseUrl);
              if (url) uploadedUrls.push(url);
            }
          }
        }
        
        // Extract text content
        let textContent = '';
        if (typeof messageData?.content === 'string') {
          textContent = messageData.content;
        } else if (Array.isArray(messageData?.content)) {
          textContent = messageData.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
        }

        // Extract markdown image URLs from text
        if (textContent) {
          const mdImages = textContent.match(/!\[.*?\]\(([^\)]+)\)/g);
          if (mdImages) {
            for (const mdImg of mdImages) {
              const urlMatch = mdImg.match(/\(([^\)]+)\)/);
              if (urlMatch?.[1] && !urlMatch[1].startsWith('data:')) {
                uploadedUrls.push(urlMatch[1]);
              }
            }
          }
        }

        console.log(`[perplexity-chat] Total images extracted: ${uploadedUrls.length}`);

        return new Response(JSON.stringify({ 
          subagent: agentName, 
          type: 'image',
          response: {
            choices: [{
              message: {
                role: 'assistant',
                content: textContent || (uploadedUrls.length > 0 ? 'Imagen generada exitosamente' : 'No se pudo generar la imagen'),
                images: uploadedUrls.map(u => ({ image_url: { url: u } })),
              }
            }]
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Text subagent - if it has tools, do a non-streaming call first to check for tool calls
      const subRequestBody: any = {
        model: agentModel,
        messages: [
          { role: "system", content: agentPrompt + (allowedTools.length > 0 ? '\n\nTienes acceso a herramientas del CRM. Úsalas cuando sea necesario para obtener datos reales.' : '') },
          ...messages.filter((m: any) => m.role !== 'system'),
          { role: "user", content: userMessage },
        ],
        stream: allowedTools.length === 0,
      };

      if (allowedTools.length > 0) {
        subRequestBody.tools = allowedTools;
        subRequestBody.tool_choice = "auto";
      }

      const subResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": supabaseUrl,
          "X-Title": "Malaga Micro CRM - Subagent",
        },
        body: JSON.stringify(subRequestBody),
      });

      if (!subResponse.ok) {
        const errText = await subResponse.text();
        return new Response(JSON.stringify({ error: `Subagente ${agentName} error: ${subResponse.status} - ${errText}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }


      // If subagent has tools, handle tool calls non-streaming then re-stream
      if (allowedTools.length > 0) {
        const subData = await subResponse.json();
        const choice = subData.choices?.[0];
        const subToolCalls = choice?.message?.tool_calls;

        if (subToolCalls && subToolCalls.length > 0 && userId) {
          // Execute tool calls
          const subToolResults: ChatMessage[] = [];
          for (const tc of subToolCalls) {
            if (!tc.function?.name) continue;
            let args = {};
            try { args = JSON.parse(tc.function.arguments); } catch {}
            const result = await executeToolCall(supabase, userId, tc.function.name, args);
            subToolResults.push({ role: "tool", content: result, tool_call_id: tc.id });
          }

          // Follow-up with tool results
          const followUp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": supabaseUrl,
              "X-Title": "Malaga Micro CRM - Subagent",
            },
            body: JSON.stringify({
              model: agentModel,
              messages: [
                ...subRequestBody.messages,
                { role: "assistant", content: choice.message.content || null, tool_calls: subToolCalls },
                ...subToolResults,
              ],
              stream: true,
            }),
          });

          if (!followUp.ok) throw new Error("Subagent follow-up failed");
          return new Response(followUp.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Subagent": agentName },
          });
        }

        // No tool calls - re-stream the response
        const reStream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": supabaseUrl,
            "X-Title": "Malaga Micro CRM - Subagent",
          },
          body: JSON.stringify({ ...subRequestBody, stream: true, tools: undefined, tool_choice: undefined }),
        });

        return new Response(reStream.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Subagent": agentName },
        });
      }

      // No tools - just stream directly
      return new Response(subResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Subagent": agentName },
      });
    }

    // --- Normal orchestrator mode ---
    const selectedModel = requestedModel || 'openai/gpt-5-nano';

    // Build subagent info for system prompt
    const subagentList = Array.isArray(clientSubagents) && clientSubagents.length > 0
      ? clientSubagents.map((s: any) => {
          const toolsInfo = Array.isArray(s.tools) && s.tools.length > 0 ? ` Herramientas: ${s.tools.join(', ')}` : ' Sin herramientas propias';
          return `- **${s.name}** (${s.agent_type}): ${s.description || s.role_prompt?.substring(0, 80) || 'Sin descripción'}. Modelo: ${s.model}.${toolsInfo}`;
        }).join('\n')
      : '';

    // Detect image and audio subagents
    const imageSubagent = Array.isArray(clientSubagents) ? clientSubagents.find((s: any) => s.agent_type === 'image') : null;
    const audioSubagent = Array.isArray(clientSubagents) ? clientSubagents.find((s: any) => s.agent_type === 'audio') : null;

    const delegationInstructions = subagentList 
      ? `\n\n**SUBAGENTES DISPONIBLES:**
Tienes acceso a subagentes especializados. Cuando una tarea se beneficie de un agente especializado, usa la herramienta delegate_to_subagent.
${subagentList}

**REGLAS DE DELEGACIÓN OBLIGATORIAS (NUNCA IGNORAR):**
1. **OBLIGATORIO:** Si el usuario pide una IMAGEN (generar, crear, dibujar, hacer foto, ilustración, diseño visual), DEBES llamar a delegate_to_subagent con el agente de tipo imagen${imageSubagent ? ` ("${imageSubagent.name}")` : ''}. NUNCA respondas con texto diciendo que no puedes generar imágenes. SÍ PUEDES, a través del subagente.
2. **OBLIGATORIO:** Si el usuario pide AUDIO (generar audio, texto a voz, narración, música), DEBES llamar a delegate_to_subagent con el agente de tipo audio${audioSubagent ? ` ("${audioSubagent.name}")` : ''}. NUNCA respondas con texto diciendo que no puedes generar audio.
3. Cuando delegues, NO escribas un mensaje largo explicando qué vas a hacer. Simplemente llama a delegate_to_subagent INMEDIATAMENTE.
4. NO envíes texto de confirmación antes de delegar (nada de "voy a generar...", "delegando a...", "no puedo generar...").
5. El subagente se encarga de todo. Tu trabajo es SOLO llamar a delegate_to_subagent con los parámetros correctos.
6. Para imágenes: pasa la descripción detallada del usuario en task_description. El subagente generará la imagen directamente.
7. **MULTI-AGENTE**: Puedes llamar delegate_to_subagent VARIAS VECES en la misma respuesta.
8. **ENCADENAMIENTO**: Si un agente necesita el resultado de otro, usa depends_on.
9. **PROHIBIDO:** Responder "no puedo generar imágenes" o "no tengo herramienta de imágenes" cuando tienes subagentes de imagen disponibles. Esto está TERMINANTEMENTE PROHIBIDO.`
      : '';

    const systemPrompt = `Eres un asistente de CRM inteligente con acceso COMPLETO a toda la aplicación. 

**MODELO ACTUAL:** ${selectedModel}
${delegationInstructions}

Puedes:

**GESTIÓN DE LEADS:**
- Buscar, crear, actualizar y eliminar leads
- Ver estadísticas y métricas de leads
- Organizar leads por carpetas

**PRESUPUESTOS STEL ORDER:**
- Listar todos los presupuestos de STEL Order
- Ver detalle completo de un presupuesto (líneas, cliente, totales)
- Crear nuevos presupuestos con cliente y líneas de productos
- Actualizar presupuestos existentes
- Eliminar presupuestos
- Convertir presupuestos en facturas
- Convertir presupuestos en pedidos
- Buscar clientes de STEL Order

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
- Ver archivos compartidos y carpetas
- Ver plantillas de email
- **Leer archivos e imágenes de la Memoria IA** (documentos, logos, imágenes subidas por el admin)

**MEMORIA IA:**
- Consultar recuerdos almacenados (get_ai_memories)
- Leer archivos/imágenes de la memoria IA (view_ai_memory_file)
- Si el usuario pregunta por un archivo, imagen o logo, busca PRIMERO en view_ai_memory_file y LUEGO en view_shared_file

**CAMPAÑAS:**
- Ver campañas de email y sus estadísticas

**SOPORTE:**
- Ver tickets de osTicket

**CALENDARIO:**
- Ver eventos del calendario (filtrar por fechas)
- Crear nuevos eventos con título, fecha, hora y descripción
- **Compartir eventos con otros usuarios del equipo** (permisos de ver o editar)

**AUDITORÍA:**
- Ver registro de acciones del sistema

Responde siempre en español de forma concisa y útil. Cuando el usuario pregunte algo, usa las herramientas apropiadas para obtener la información real del sistema.
Si necesitas buscar un lead o información específica, siempre usa las herramientas disponibles en lugar de inventar datos.
Para presupuestos, usa las herramientas stel_* para interactuar con STEL Order.`;

    const conversationMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const canUseTools = Boolean(userId);

    const requestBody: any = {
      model: selectedModel,
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
        return new Response(JSON.stringify({ error: "Límite de uso excedido. Intenta más tarde." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    // Handle tool calls
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let toolCalls: ToolCall[] = [];

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

          if (delta?.content) fullContent += delta.content;

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = { id: tc.id || "", type: "function", function: { name: "", arguments: "" } };
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

    // Execute tool calls if any
    if (toolCalls.length > 0 && userId) {
      // Check if ANY tool calls are delegations
      const delegationCalls = toolCalls.filter(tc => tc.function.name === 'delegate_to_subagent');
      if (delegationCalls.length > 0) {
        // Parse all delegation arguments
        const delegations = delegationCalls.map(dc => {
          let args: any = {};
          try { args = JSON.parse(dc.function.arguments); } catch {}
          return args;
        });
        
        // Send ALL delegations to client as a single SSE response
        const sseData = `data: ${JSON.stringify({
          choices: [{
            delta: {
              content: null,
              tool_calls: delegations.map((args: any) => ({ 
                function: { name: 'delegate_to_subagent', arguments: JSON.stringify(args) } 
              }))
            }
          }]
        })}\n\ndata: [DONE]\n\n`;
        
        return new Response(sseData, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      }

      const toolResults: ChatMessage[] = [];

      for (const tc of toolCalls) {
        if (!tc.function.name) continue;
        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch {}

        const result = await executeToolCall(supabase, userId, tc.function.name, args);
        toolResults.push({ role: "tool", content: result, tool_call_id: tc.id });
      }

      const followUpMessages = [
        ...conversationMessages,
        { role: "assistant" as const, content: fullContent || null, tool_calls: toolCalls },
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
        body: JSON.stringify({ model: selectedModel, messages: followUpMessages, stream: true }),
      });

      if (!followUpResponse.ok) throw new Error("Follow-up request failed");

      return new Response(followUpResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
      });
    }

    // --- SERVER-SIDE FORCED DELEGATION ---
    // If the model responded with text instead of delegating for image/audio requests,
    // detect and force delegation automatically
    const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
    const imageKeywords = ['imagen', 'foto', 'dibujo', 'ilustracion', 'ilustración', 'genera una imagen', 'crea una imagen', 'dibuja', 'generar imagen', 'crear imagen', 'diseña', 'image', 'picture', 'draw', 'generate image', 'crearme una imagen', 'créame', 'creame'];
    const audioKeywords = ['audio', 'voz', 'narración', 'narracion', 'texto a voz', 'tts', 'lee en voz alta', 'genera audio'];
    
    const isImageRequest = imageKeywords.some(kw => lastUserMsg.includes(kw));
    const isAudioRequest = audioKeywords.some(kw => lastUserMsg.includes(kw));
    
    const refusalPatterns = ['no puedo generar', 'no tengo habilitad', 'no tengo la herramienta', 'no puedo crear imagen', 'no tengo capacidad', 'cannot generate', 'i cannot create', 'no tengo aquí', 'prompt listo', 'prompt perfecto para'];
    const didRefuse = refusalPatterns.some(p => fullContent.toLowerCase().includes(p));
    
    if ((isImageRequest || isAudioRequest) && (toolCalls.length === 0 || didRefuse)) {
      const targetSubagent = isImageRequest ? imageSubagent : audioSubagent;
      
      if (targetSubagent) {
        console.log(`[perplexity-chat] FORCED DELEGATION: Model refused/missed delegation for ${isImageRequest ? 'image' : 'audio'} request. Forcing to ${targetSubagent.name}`);
        
        const forcedDelegation = {
          agent_name: targetSubagent.name,
          task_description: typeof messages[messages.length - 1]?.content === 'string' ? messages[messages.length - 1].content : lastUserMsg,
        };
        
        const sseData = `data: ${JSON.stringify({
          choices: [{
            delta: {
              content: null,
              tool_calls: [{ 
                function: { name: 'delegate_to_subagent', arguments: JSON.stringify(forcedDelegation) } 
              }]
            }
          }]
        })}\n\ndata: [DONE]\n\n`;
        
        return new Response(sseData, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      }
    }

    // No tool calls - recreate stream
    const newResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": supabaseUrl,
        "X-Title": "Malaga Micro CRM",
      },
      body: JSON.stringify({ model: selectedModel, messages: conversationMessages, stream: true }),
    });

    return new Response(newResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });

  } catch (err: any) {
    console.error("Chat error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
