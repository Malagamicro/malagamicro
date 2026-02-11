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

    const { messages, model: requestedModel } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error("Messages array is required");
    }

    const allowedModels = ['openai/gpt-5-nano', 'openai/gpt-oss-120b'];
    const selectedModel = allowedModels.includes(requestedModel) ? requestedModel : 'openai/gpt-5-nano';

    const modelDescriptions: Record<string, string> = {
      'openai/gpt-5-nano': 'GPT-5 Nano: modelo rápido y eficiente, ideal para tareas sencillas, respuestas rápidas y alto volumen de consultas. Menor coste.',
      'openai/gpt-oss-120b': 'GPT-OSS 120B: modelo open source de 120 mil millones de parámetros, excelente razonamiento y precisión. Más potente pero más lento.',
    };

    const systemPrompt = `Eres un asistente de CRM inteligente con acceso COMPLETO a toda la aplicación. 

**MODELO ACTUAL:** ${modelDescriptions[selectedModel]}

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

**CAMPAÑAS:**
- Ver campañas de email y sus estadísticas

**SOPORTE:**
- Ver tickets de osTicket

**AUDITORÍA:**
- Ver registro de acciones del sistema

Si el usuario pregunta qué modelo estás usando o qué hace cada modelo, explícale las diferencias:
- **GPT-5 Nano**: Rápido, eficiente, bueno para tareas sencillas y alto volumen. Menor coste por consulta.
- **GPT-OSS 120B**: Modelo open source grande (120B parámetros), mejor razonamiento y precisión en tareas complejas. Más lento pero más capaz.

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
