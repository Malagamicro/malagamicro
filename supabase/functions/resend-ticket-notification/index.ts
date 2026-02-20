import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = (Deno.env.get('EVOLUTION_API_URL') || 'https://evolutionapi.malagamicro.com').replace(/\/+$/, '');
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';
const INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'CRM';
const DEFAULT_IMAGE_URL = 'https://malagamicro.lovable.app/images/nuevo-ticket.png';

function formatPhoneNumber(phone: string): string {
  let clean = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (clean.length === 9) clean = '34' + clean;
  return clean;
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderTemplate(template: string, data: Record<string, string>, osticketUrl: string): string {
  const ticketUrl = `${osticketUrl}/scp/tickets.php?id=${data.ticket_id || ''}`;
  return template
    .replace(/\{\{ticket_id\}\}/g, data.ticket_id || 'N/A')
    .replace(/\{\{number\}\}/g, data.number || 'N/A')
    .replace(/\{\{subject\}\}/g, stripHtml(data.subject || 'Sin asunto'))
    .replace(/\{\{name\}\}/g, stripHtml(data.name || 'N/A'))
    .replace(/\{\{email\}\}/g, data.email || 'N/A')
    .replace(/\{\{department\}\}/g, data.department || 'N/A')
    .replace(/\{\{priority\}\}/g, data.priority || 'Normal')
    .replace(/\{\{message\}\}/g, stripHtml(data.message || ''))
    .replace(/\{\{ticket_url\}\}/g, ticketUrl);
}

async function sendWA(phone: string, message: string, imageUrl: string, sendImage: boolean): Promise<boolean> {
  const cleanPhone = formatPhoneNumber(phone);
  if (sendImage && imageUrl) {
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({ number: cleanPhone, mediatype: 'image', media: imageUrl, caption: message }),
    });
    if (res.ok) return true;
    console.warn('Media failed, falling back to text');
  }
  const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
    body: JSON.stringify({ number: cleanPhone, text: message }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's osticket config
    const { data: config } = await supabase
      .from('osticket_config')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!config || !config.is_enabled) {
      return new Response(JSON.stringify({ error: 'osTicket integration not configured or disabled' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.notification_numbers || config.notification_numbers.length === 0) {
      return new Response(JSON.stringify({ error: 'No notification numbers configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Support custom_message for manual sends from the panel
    const message = body.custom_message
      ? body.custom_message
      : renderTemplate(config.message_template, body, config.osticket_url);

    // Support custom_image_url override (null = no image)
    const imageUrl = body.custom_image_url !== undefined
      ? (body.custom_image_url || '')
      : ((config as any).image_url || DEFAULT_IMAGE_URL);
    const sendImage = body.custom_image_url !== undefined
      ? !!body.custom_image_url
      : (config as any).send_image !== false;

    let sent = 0, failed = 0;
    for (const phone of config.notification_numbers) {
      if (sent + failed > 0) await new Promise(r => setTimeout(r, 1000));
      const ok = await sendWA(phone, message, imageUrl, sendImage);
      ok ? sent++ : failed++;
    }

    return new Response(JSON.stringify({ success: true, sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in resend-ticket-notification:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
