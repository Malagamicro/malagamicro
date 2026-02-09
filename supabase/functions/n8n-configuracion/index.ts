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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // Verificar que es admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      throw new Error('Admin access required');
    }

    // Obtener proveedores activos
    const { data: providers } = await supabase
      .from('providers')
      .select('*')
      .eq('activo', true);

    // Obtener plantillas de email activas
    const { data: templates } = await supabase
      .from('email_templates')
      .select('*')
      .eq('is_active', true);

    const config = {
      smtp: {
        host: Deno.env.get('SMTP_HOST') || null,
        port: parseInt(Deno.env.get('SMTP_PORT') || '587'),
        from_email: Deno.env.get('SMTP_FROM_EMAIL') || null,
        from_name: Deno.env.get('SMTP_FROM_NAME') || null,
        configured: !!(Deno.env.get('SMTP_HOST') && Deno.env.get('SMTP_USER')),
      },
      imap: {
        host: Deno.env.get('IMAP_HOST') || null,
        port: parseInt(Deno.env.get('IMAP_PORT') || '993'),
        user: Deno.env.get('IMAP_USER') || null,
        configured: !!(Deno.env.get('IMAP_HOST') && Deno.env.get('IMAP_USER')),
      },
      waha: {
        url: Deno.env.get('WAHA_API_URL') || null,
        session: 'default',
        configured: !!Deno.env.get('WAHA_API_URL'),
      },
      stelorder: {
        api_url: Deno.env.get('STELORDER_API_URL') || null,
        configured: !!Deno.env.get('STELORDER_API_KEY'),
      },
      n8n: {
        webhook_url: Deno.env.get('N8N_WEBHOOK_URL') || null,
        configured: !!Deno.env.get('N8N_WEBHOOK_URL'),
      },
      providers: providers || [],
      email_templates: templates || [],
      endpoints: {
        budget_request: '/functions/v1/budget-request',
        receive_budget: '/functions/v1/receive-budget-from-n8n',
        notify_approval: '/functions/v1/notify-n8n-approval',
        send_to_stel: '/functions/v1/send-to-stel-order',
        email_enviado: '/functions/v1/n8n-email-enviado',
        imap_check: '/functions/v1/imap-check',
      }
    };

    return new Response(
      JSON.stringify(config),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
