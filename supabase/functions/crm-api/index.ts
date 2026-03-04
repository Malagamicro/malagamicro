import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract Bearer token
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing Bearer token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validate API key
    const { data: userId, error: keyError } = await supabase.rpc('validate_api_key', { _api_key: token });
    if (keyError || !userId) {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update last_used_at
    await supabase.from('user_api_keys').update({ last_used_at: new Date().toISOString() }).eq('api_key', token);

    // Parse URL path and body
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Expected: /crm-api/{resource}/{action?}/{id?}
    // e.g. /crm-api/leads, /crm-api/leads/abc-123
    const resource = pathParts[1] || '';
    const idOrAction = pathParts[2] || '';

    let body: Record<string, unknown> = {};
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      try { body = await req.json(); } catch { body = {}; }
    }

    // Search params for GET
    const params = Object.fromEntries(url.searchParams.entries());

    // Route to handlers
    let result: unknown;

    switch (resource) {
      // ===== LEADS =====
      case 'leads': {
        if (req.method === 'GET' && !idOrAction) {
          // List leads
          let query = supabase.from('leads').select('*').eq('user_id', userId);
          if (params.status) query = query.eq('status', params.status);
          if (params.search) query = query.or(`company_name.ilike.%${params.search}%,contact_name.ilike.%${params.search}%,email.ilike.%${params.search}%`);
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
          // Get user email profile
          let profileQuery = supabase.from('email_profiles').select('*').eq('user_id', userId);
          if (profile_id) profileQuery = profileQuery.eq('id', profile_id);
          else profileQuery = profileQuery.eq('is_default', true);
          const { data: profile } = await profileQuery.single();
          if (!profile) throw new Error('No email profile found');
          
          // Use the send-smtp-email function internally
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

      default:
        return new Response(JSON.stringify({ error: `Unknown resource: ${resource}`, available_resources: ['leads', 'lead-activities', 'reminders', 'calendar', 'notes', 'providers', 'ai-memory', 'tickets', 'send-whatsapp', 'send-email', 'profile'] }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('CRM API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
