import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = data.claims.sub;
    const userEmail = data.claims.email;

    const { action, rowData, rowIndex, headers: colHeaders, customWebhookUrl } = await req.json();

    if (!action || !rowData) {
      throw new Error('Missing action or rowData');
    }

    const N8N_WEBHOOK_URL = Deno.env.get('N8N_WEBHOOK_URL');
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    // Build structured row object from headers + values
    const structuredRow: Record<string, string> = {};
    if (colHeaders && Array.isArray(colHeaders)) {
      colHeaders.forEach((h: string, i: number) => {
        if (h) structuredRow[h] = rowData[i] || '';
      });
    }
    // Also include raw indexed data
    const payload = {
      action,
      rowIndex,
      rowData,
      structuredRow,
      headers: colHeaders,
      timestamp: new Date().toISOString(),
      userId,
      userEmail,
    };

    let result: any = { success: true };

    switch (action) {
      case 'send_whatsapp': {
        // Find phone number in row data
        const phone = findValueByKey(structuredRow, ['teléfono', 'telefono', 'phone', 'móvil', 'movil', 'whatsapp', 'tel']) 
          || rowData.find((v: string) => /^(\+?\d[\d\s-]{7,})$/.test(v?.trim()));
        
        if (!phone) {
          throw new Error('No se encontró un número de teléfono en la fila');
        }

        const name = findValueByKey(structuredRow, ['nombre', 'name', 'cliente', 'contacto', 'empresa']) || 'Cliente';
        const message = findValueByKey(structuredRow, ['mensaje', 'message', 'nota', 'notas', 'observaciones']) 
          || `Hola ${name}, le contactamos desde MalagaMicro.`;

        if (EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE_NAME) {
          // Send via Evolution API
          const cleanPhone = phone.replace(/[\s-()]/g, '').replace(/^\+/, '');
          const chatId = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
          
          const waResp = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              number: chatId,
              text: message,
            }),
          });

          if (!waResp.ok) {
            const errText = await waResp.text();
            throw new Error(`Error al enviar WhatsApp: ${errText}`);
          }
          result = { success: true, message: `WhatsApp enviado a ${phone}` };
        } else {
          throw new Error('Evolution API no está configurada');
        }
        break;
      }

      case 'send_to_n8n':
      case 'custom_webhook': {
        const webhookUrl = action === 'custom_webhook' && customWebhookUrl 
          ? customWebhookUrl 
          : N8N_WEBHOOK_URL;
        
        if (!webhookUrl) {
          throw new Error('No hay URL de webhook configurada');
        }

        const webhookResp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!webhookResp.ok) {
          const errText = await webhookResp.text();
          throw new Error(`Error en webhook: ${webhookResp.status} - ${errText}`);
        }

        const webhookResult = await webhookResp.json().catch(() => ({}));
        result = { success: true, message: 'Datos enviados a n8n', webhookResult };
        break;
      }

      case 'send_email_reminder': {
        // Forward to n8n with specific action type
        if (!N8N_WEBHOOK_URL) throw new Error('N8N no configurado');
        
        const emailPayload = {
          ...payload,
          action: 'email_reminder',
          email: findValueByKey(structuredRow, ['email', 'correo', 'e-mail', 'mail']),
          name: findValueByKey(structuredRow, ['nombre', 'name', 'cliente', 'contacto']),
        };

        const emailResp = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPayload),
        });

        if (!emailResp.ok) throw new Error('Error al enviar recordatorio');
        result = { success: true, message: 'Recordatorio enviado vía n8n' };
        break;
      }

      default:
        throw new Error(`Acción desconocida: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('spreadsheet-action error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function findValueByKey(obj: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    for (const [k, v] of Object.entries(obj)) {
      if (k.toLowerCase().includes(key.toLowerCase()) && v?.trim()) {
        return v.trim();
      }
    }
  }
  return null;
}
