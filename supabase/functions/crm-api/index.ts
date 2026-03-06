import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Security Utilities ---
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|TRUNCATE|GRANT|REVOKE)\b)/i,
  /(--|\/\*|\*\/|xp_|sp_)/i,
  /('|")\s*(OR|AND)\s*('|")/i,
  /(\bOR\b\s+\d+\s*=\s*\d+)/i,
  /(WAITFOR\s+DELAY|BENCHMARK\s*\(|SLEEP\s*\()/i,
];

function containsSqlInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some(p => p.test(input));
}

function sanitizeSearchParam(input: string): string {
  return input
    .replace(/[;'"\\`]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .trim()
    .slice(0, 200);
}

function isValidUuid(input: string): boolean {
  return UUID_REGEX.test(input);
}

function sanitizeBodyForDb(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const allowedKeyPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  for (const [key, value] of Object.entries(obj)) {
    if (!allowedKeyPattern.test(key)) continue;
    if (typeof value === 'string') {
      if (containsSqlInjection(value)) {
        sanitized[key] = value.replace(/[;'"\\`]/g, '').replace(/--/g, '').trim();
      } else {
        sanitized[key] = value;
      }
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeBodyForDb(value as Record<string, unknown>);
    }
  }
  return sanitized;
}

// --- Rate limiting per IP ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 120; // 120 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing Bearer token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate token format (prevent injection via token)
    if (token.length > 200 || containsSqlInjection(token)) {
      return new Response(JSON.stringify({ error: 'Invalid token format' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: userId, error: keyError } = await supabase.rpc('validate_api_key', { _api_key: token });
    if (keyError || !userId) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await supabase.from('user_api_keys').update({ last_used_at: new Date().toISOString() }).eq('api_key', token);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const resource = pathParts[1] || '';
    const idOrAction = pathParts[2] || '';

    // Validate resource name (alphanumeric and hyphens only)
    if (resource && !/^[a-z0-9-]+$/.test(resource)) {
      return new Response(JSON.stringify({ error: 'Invalid resource' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate idOrAction as UUID if present, or allow action-like strings for some resources
    if (idOrAction && !isValidUuid(idOrAction) && !/^[a-z0-9-]+$/.test(idOrAction)) {
      return new Response(JSON.stringify({ error: 'Invalid resource ID format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let body: Record<string, unknown> = {};
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      try { body = sanitizeBodyForDb(await req.json()); } catch { body = {}; }
    }

    // Sanitize query params
    const rawParams = Object.fromEntries(url.searchParams.entries());
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawParams)) {
      if (containsSqlInjection(v)) {
        params[k] = sanitizeSearchParam(v);
      } else {
        params[k] = v.slice(0, 500);
      }
    }
    let result: unknown;

    switch (resource) {
      // ===== LEADS =====
      case 'leads': {
        if (req.method === 'GET' && !idOrAction) {
          let query = supabase.from('leads').select('*').eq('user_id', userId);
          if (params.status) query = query.eq('status', params.status);
          if (params.search) {
            const safeSearch = sanitizeSearchParam(params.search);
            if (safeSearch) {
              query = query.or(`company_name.ilike.%${safeSearch}%,contact_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
            }
          }
          if (params.limit) query = query.limit(parseInt(params.limit));
          if (params.offset) query = query.range(parseInt(params.offset), parseInt(params.offset) + parseInt(params.limit || '50') - 1);
          const { data, error } = await query.order('created_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'GET' && idOrAction) {
          const { data, error } = await supabase.from('leads').select('*').eq('id', idOrAction).eq('user_id', userId).single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('leads').insert({ ...body, user_id: userId }).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'PATCH' && idOrAction) {
          const { user_id: _, ...updateData } = body as any;
          const { data, error } = await supabase.from('leads').update(updateData).eq('id', idOrAction).eq('user_id', userId).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'DELETE' && idOrAction) {
          const { error } = await supabase.from('leads').delete().eq('id', idOrAction).eq('user_id', userId);
          if (error) throw error;
          result = { success: true };
        }
        break;
      }

      // ===== LEAD ACTIVITIES =====
      case 'lead-activities': {
        if (req.method === 'GET') {
          const leadId = params.lead_id;
          if (!leadId) throw new Error('lead_id is required');
          const { data, error } = await supabase.from('lead_activities').select('*').eq('lead_id', leadId).eq('user_id', userId).order('created_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('lead_activities').insert({ ...body, user_id: userId }).select().single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== LEAD FOLDERS =====
      case 'lead-folders': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('lead_folders').select('*').eq('user_id', userId).order('name');
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('lead_folders').insert({ ...body, user_id: userId }).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'DELETE' && idOrAction) {
          const { error } = await supabase.from('lead_folders').delete().eq('id', idOrAction).eq('user_id', userId);
          if (error) throw error;
          result = { success: true };
        }
        break;
      }

      // ===== REMINDERS =====
      case 'reminders': {
        if (req.method === 'GET') {
          let query = supabase.from('general_reminders').select('*').eq('user_id', userId);
          if (params.completed === 'false') query = query.eq('is_completed', false);
          if (params.completed === 'true') query = query.eq('is_completed', true);
          const { data, error } = await query.order('reminder_date', { ascending: true });
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('general_reminders').insert({ ...body, user_id: userId }).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'PATCH' && idOrAction) {
          const { data, error } = await supabase.from('general_reminders').update(body).eq('id', idOrAction).eq('user_id', userId).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'DELETE' && idOrAction) {
          const { error } = await supabase.from('general_reminders').delete().eq('id', idOrAction).eq('user_id', userId);
          if (error) throw error;
          result = { success: true };
        }
        break;
      }

      // ===== CALENDAR =====
      case 'calendar': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('calendar_events').select('*').eq('creator_id', userId).order('event_date', { ascending: true });
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('calendar_events').insert({ ...body, creator_id: userId }).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'PATCH' && idOrAction) {
          const { data, error } = await supabase.from('calendar_events').update(body).eq('id', idOrAction).eq('creator_id', userId).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'DELETE' && idOrAction) {
          const { error } = await supabase.from('calendar_events').delete().eq('id', idOrAction).eq('creator_id', userId);
          if (error) throw error;
          result = { success: true };
        }
        break;
      }

      // ===== NOTES =====
      case 'notes': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('quick_notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('quick_notes').insert({ ...body, user_id: userId }).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'PATCH' && idOrAction) {
          const { data, error } = await supabase.from('quick_notes').update(body).eq('id', idOrAction).eq('user_id', userId).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'DELETE' && idOrAction) {
          const { error } = await supabase.from('quick_notes').delete().eq('id', idOrAction).eq('user_id', userId);
          if (error) throw error;
          result = { success: true };
        }
        break;
      }

      // ===== PROVIDERS =====
      case 'providers': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('providers').select('*').eq('user_id', userId).order('nombre');
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('providers').insert({ ...body, user_id: userId }).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'PATCH' && idOrAction) {
          const { data, error } = await supabase.from('providers').update(body).eq('id', idOrAction).eq('user_id', userId).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'DELETE' && idOrAction) {
          const { error } = await supabase.from('providers').delete().eq('id', idOrAction).eq('user_id', userId);
          if (error) throw error;
          result = { success: true };
        }
        break;
      }

      // ===== AI MEMORY =====
      case 'ai-memory': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('ai_memory').select('*').or(`user_id.eq.${userId},is_shared.eq.true`).order('updated_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('ai_memory').insert({ ...body, user_id: userId }).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'PATCH' && idOrAction) {
          const { data, error } = await supabase.from('ai_memory').update(body).eq('id', idOrAction).eq('user_id', userId).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'DELETE' && idOrAction) {
          const { error } = await supabase.from('ai_memory').delete().eq('id', idOrAction).eq('user_id', userId);
          if (error) throw error;
          result = { success: true };
        }
        break;
      }

      // ===== TICKETS =====
      case 'tickets': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('osticket_tickets').select('*').eq('user_id', userId).order('created_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('osticket_tickets').insert({ ...body, user_id: userId }).select().single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== TICKET NOTES =====
      case 'ticket-notes': {
        if (req.method === 'GET') {
          const ticketId = params.ticket_id;
          if (!ticketId) throw new Error('ticket_id is required');
          const { data, error } = await supabase.from('ticket_notes').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('ticket_notes').insert({ ...body, user_id: userId }).select().single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== INTERNAL CHAT =====
      case 'conversations': {
        if (req.method === 'GET' && !idOrAction) {
          // List conversations where user is participant
          const { data: participations, error: pErr } = await supabase
            .from('conversation_participants').select('conversation_id').eq('user_id', userId);
          if (pErr) throw pErr;
          const convIds = (participations || []).map((p: any) => p.conversation_id);
          if (convIds.length === 0) { result = []; break; }
          const { data, error } = await supabase.from('internal_conversations').select('*').in('id', convIds).order('updated_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'GET' && idOrAction) {
          // Get messages of a conversation
          const { data, error } = await supabase.from('internal_messages').select('*').eq('conversation_id', idOrAction).order('created_at', { ascending: true }).limit(parseInt(params.limit || '100'));
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST' && !idOrAction) {
          // Create conversation
          const { data: conv, error: cErr } = await supabase.from('internal_conversations').insert({ name: body.name as string || null, is_group: !!body.is_group, created_by: userId }).select().single();
          if (cErr) throw cErr;
          // Add creator as participant
          await supabase.from('conversation_participants').insert({ conversation_id: conv.id, user_id: userId, is_admin: true });
          // Add other participants
          const participantIds = (body.participant_ids as string[]) || [];
          for (const pid of participantIds) {
            if (pid !== userId) {
              await supabase.from('conversation_participants').insert({ conversation_id: conv.id, user_id: pid });
            }
          }
          result = conv;
        }
        break;
      }

      // ===== SEND INTERNAL MESSAGE =====
      case 'send-message': {
        if (req.method === 'POST') {
          const { conversation_id, content } = body as { conversation_id: string; content: string };
          if (!conversation_id || !content) throw new Error('conversation_id and content are required');
          const { data, error } = await supabase.from('internal_messages').insert({ conversation_id, content, sender_id: userId, message_type: 'text' }).select().single();
          if (error) throw error;
          // Update conversation timestamp
          await supabase.from('internal_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversation_id);
          result = data;
        }
        break;
      }

      // ===== SHARED FILES =====
      case 'shared-files': {
        if (req.method === 'GET') {
          let query = supabase.from('shared_files').select('*');
          if (params.folder_id) query = query.eq('folder_id', params.folder_id);
          else query = query.is('folder_id', null);
          const { data, error } = await query.order('created_at', { ascending: false });
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== SHARED FOLDERS =====
      case 'shared-folders': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('shared_folders').select('*').order('name');
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('shared_folders').insert({ ...body, user_id: userId }).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'DELETE' && idOrAction) {
          const { error } = await supabase.from('shared_folders').delete().eq('id', idOrAction).eq('user_id', userId);
          if (error) throw error;
          result = { success: true };
        }
        break;
      }

      // ===== AUDIT LOGS =====
      case 'audit-logs': {
        if (req.method === 'GET') {
          let query = supabase.from('audit_logs').select('*');
          if (params.user_id) query = query.eq('user_id', params.user_id);
          if (params.action) query = query.eq('action', params.action);
          if (params.entity_type) query = query.eq('entity_type', params.entity_type);
          const { data, error } = await query.order('created_at', { ascending: false }).limit(parseInt(params.limit || '100'));
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('audit_logs').insert({ ...body, user_id: userId }).select().single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== LOGIN LOGS =====
      case 'login-logs': {
        if (req.method === 'GET') {
          let query = supabase.from('user_login_logs').select('*');
          if (params.user_id) query = query.eq('user_id', params.user_id);
          const { data, error } = await query.order('created_at', { ascending: false }).limit(parseInt(params.limit || '50'));
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== SECURITY BLOCKS =====
      case 'security-blocks': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('login_security_blocks').select('*').eq('is_active', true).order('created_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          // Create a block
          const { data, error } = await supabase.from('login_security_blocks').insert({ ...body }).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'PATCH' && idOrAction) {
          // Deactivate a block
          const { data, error } = await supabase.from('login_security_blocks').update({ is_active: false, resolved_at: new Date().toISOString(), resolved_by: userId }).eq('id', idOrAction).select().single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== IP WHITELIST =====
      case 'ip-whitelist': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('ip_whitelist').select('*').order('created_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('ip_whitelist').insert({ ...body, added_by: userId }).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'DELETE' && idOrAction) {
          const { error } = await supabase.from('ip_whitelist').delete().eq('id', idOrAction);
          if (error) throw error;
          result = { success: true };
        }
        break;
      }

      // ===== USER PRESENCE =====
      case 'user-presence': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('user_presence').select('*').eq('is_online', true).order('last_seen_at', { ascending: false });
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== PROFILES (list all) =====
      case 'profiles': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('profiles').select('*').order('full_name');
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== EMAIL CAMPAIGNS =====
      case 'campaigns': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('email_campaigns').select('*').eq('user_id', userId).order('created_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('email_campaigns').insert({ ...body, user_id: userId }).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'PATCH' && idOrAction) {
          const { data, error } = await supabase.from('email_campaigns').update(body).eq('id', idOrAction).eq('user_id', userId).select().single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== EMAIL TEMPLATES =====
      case 'email-templates': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('email_templates').select('*').eq('user_id', userId).order('created_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('email_templates').insert({ ...body, user_id: userId }).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'PATCH' && idOrAction) {
          const { data, error } = await supabase.from('email_templates').update(body).eq('id', idOrAction).eq('user_id', userId).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'DELETE' && idOrAction) {
          const { error } = await supabase.from('email_templates').delete().eq('id', idOrAction).eq('user_id', userId);
          if (error) throw error;
          result = { success: true };
        }
        break;
      }

      // ===== MESSAGE TEMPLATES (WhatsApp) =====
      case 'message-templates': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('message_templates').select('*').eq('user_id', userId).order('name');
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('message_templates').insert({ ...body, user_id: userId }).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'DELETE' && idOrAction) {
          const { error } = await supabase.from('message_templates').delete().eq('id', idOrAction).eq('user_id', userId);
          if (error) throw error;
          result = { success: true };
        }
        break;
      }

      // ===== BUDGET REQUESTS =====
      case 'budget-requests': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('budget_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'GET' && idOrAction) {
          const { data, error } = await supabase.from('budget_requests').select('*').eq('id', idOrAction).eq('user_id', userId).single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== BUDGETS RECEIVED =====
      case 'budgets-received': {
        if (req.method === 'GET') {
          let query = supabase.from('budgets_received').select('*').eq('user_responsible', userId);
          if (params.request_id) query = query.eq('request_id', params.request_id);
          const { data, error } = await query.order('created_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'PATCH' && idOrAction) {
          const { data, error } = await supabase.from('budgets_received').update(body).eq('id', idOrAction).eq('user_responsible', userId).select().single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== WHATSAPP CHATS =====
      case 'whatsapp-chats': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('whatsapp_chats').select('*').eq('user_id', userId).order('last_message_at', { ascending: false });
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== WHATSAPP MESSAGES =====
      case 'whatsapp-messages': {
        if (req.method === 'GET') {
          const chatId = params.chat_id;
          if (!chatId) throw new Error('chat_id is required');
          const { data, error } = await supabase.from('waha_messages').select('*').eq('chat_id', chatId).eq('user_id', userId).order('timestamp', { ascending: true }).limit(parseInt(params.limit || '100'));
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== REPORTS =====
      case 'reports': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('reports').select('*').eq('generated_by', userId).order('created_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { data, error } = await supabase.from('reports').insert({ ...body, generated_by: userId }).select().single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== SEO ARTICLES =====
      case 'seo-articles': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('seo_articles').select('*').eq('user_id', userId).order('created_at', { ascending: false });
          if (error) throw error;
          result = data;
        } else if (req.method === 'GET' && idOrAction) {
          const { data, error } = await supabase.from('seo_articles').select('*').eq('id', idOrAction).eq('user_id', userId).single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== WHATSAPP =====
      case 'send-whatsapp': {
        if (req.method === 'POST') {
          const wahaUrl = Deno.env.get('WAHA_API_URL');
          const wahaKey = Deno.env.get('WAHA_API_KEY');
          if (!wahaUrl || !wahaKey) throw new Error('WhatsApp not configured');
          const { phone, message } = body as { phone: string; message: string };
          if (!phone || !message) throw new Error('phone and message are required');
          const resp = await fetch(`${wahaUrl}/api/sendText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Api-Key': wahaKey },
            body: JSON.stringify({ chatId: phone.includes('@') ? phone : `${phone}@c.us`, text: message, session: 'default' }),
          });
          result = await resp.json();
        }
        break;
      }

      // ===== SEND EMAIL =====
      case 'send-email': {
        if (req.method === 'POST') {
          const { to, subject, body: emailBody, profile_id } = body as { to: string; subject: string; body: string; profile_id?: string };
          if (!to || !subject || !emailBody) throw new Error('to, subject, and body are required');
          let profileQuery = supabase.from('email_profiles').select('*').eq('user_id', userId);
          if (profile_id) profileQuery = profileQuery.eq('id', profile_id);
          else profileQuery = profileQuery.eq('is_default', true);
          const { data: profile } = await profileQuery.single();
          if (!profile) throw new Error('No email profile found');
          
          const smtpResp = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              to, subject, html: emailBody,
              smtp_host: profile.smtp_host, smtp_port: profile.smtp_port,
              smtp_user: profile.smtp_user, smtp_password: profile.smtp_password,
              smtp_secure: profile.smtp_secure, from_email: profile.from_email,
              from_name: profile.from_name,
            }),
          });
          result = await smtpResp.json();
        }
        break;
      }

      // ===== AI COMPLETION =====
      case 'ai-completion': {
        if (req.method === 'POST') {
          const { prompt, model, system_prompt } = body as { prompt: string; model?: string; system_prompt?: string };
          if (!prompt) throw new Error('prompt is required');
          const aiResp = await fetch(`${supabaseUrl}/functions/v1/ai-completion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({ prompt, model: model || 'google/gemini-2.5-flash', system_prompt }),
          });
          result = await aiResp.json();
        }
        break;
      }

      // ===== PROFILE =====
      case 'profile': {
        if (req.method === 'GET') {
          const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'PATCH') {
          const { data, error } = await supabase.from('profiles').update(body).eq('user_id', userId).select().single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ===== NOTIFICATIONS =====
      case 'notifications': {
        if (req.method === 'GET') {
          let query = supabase.from('custom_notifications').select('*').eq('user_id', userId);
          if (params.unread_only === 'true') query = query.eq('is_read', false);
          const { data, error } = await query.order('created_at', { ascending: false }).limit(parseInt(params.limit || '50'));
          if (error) throw error;
          result = data;
        } else if (req.method === 'POST') {
          const { title, message, type, is_popup, target_user_id, action_url, action_label, metadata } = body as any;
          if (!title || !message) throw new Error('title and message are required');
          const targetId = target_user_id || userId;
          const { data, error } = await supabase.from('custom_notifications').insert({
            user_id: targetId,
            title,
            message,
            type: type || 'info',
            source: 'api',
            is_popup: is_popup || false,
            action_url,
            action_label,
            metadata,
          }).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'PATCH' && idOrAction) {
          const { data, error } = await supabase.from('custom_notifications').update(body).eq('id', idOrAction).eq('user_id', userId).select().single();
          if (error) throw error;
          result = data;
        } else if (req.method === 'DELETE' && idOrAction) {
          const { error } = await supabase.from('custom_notifications').delete().eq('id', idOrAction).eq('user_id', userId);
          if (error) throw error;
          result = { success: true };
        }
        break;
      }

      // ===== SEND NOTIFICATION (convenience for n8n) =====
      case 'send-notification': {
        if (req.method === 'POST') {
          const { title, message, type, is_popup, target_user_id, action_url, action_label, metadata } = body as any;
          if (!title || !message) throw new Error('title and message are required');
          const targetId = target_user_id || userId;
          const { data, error } = await supabase.from('custom_notifications').insert({
            user_id: targetId,
            title,
            message,
            type: type || 'n8n',
            source: 'n8n',
            is_popup: is_popup !== undefined ? is_popup : true,
            action_url,
            action_label,
            metadata,
          }).select().single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      default:
        return new Response(JSON.stringify({ 
          error: `Unknown resource: ${resource}`, 
          available_resources: [
            'leads', 'lead-activities', 'lead-folders',
            'reminders', 'calendar', 'notes', 
            'providers', 'ai-memory', 'ai-completion',
            'tickets', 'ticket-notes',
            'conversations', 'send-message',
            'send-whatsapp', 'send-email',
            'whatsapp-chats', 'whatsapp-messages',
            'campaigns', 'email-templates', 'message-templates',
            'budget-requests', 'budgets-received',
            'shared-files', 'shared-folders',
            'audit-logs', 'login-logs', 'security-blocks', 'ip-whitelist',
            'user-presence', 'profiles', 'profile',
            'reports', 'seo-articles',
            'notifications', 'send-notification',
          ] 
        }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('CRM API Error:', error);
    // Don't expose internal error details to clients
    const safeMessage = error.message?.includes('not found') ? 'Resource not found' 
      : error.message?.includes('required') ? error.message 
      : 'An error occurred processing your request';
    return new Response(JSON.stringify({ error: safeMessage }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
