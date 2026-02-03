import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL')!;

    // Verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Service client for DB operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // CREATE REQUEST - Send to n8n
    if (req.method === 'POST' && action === 'create') {
      const body = await req.json();
      const { prompt, emails, products, email_empresa } = body;

      if (!prompt || !emails || emails.length === 0 || !products || products.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Faltan campos requeridos: prompt, emails y products' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate unique request_id
      const request_id = `BR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Save request to DB first
      const { error: insertError } = await serviceClient
        .from('budget_requests')
        .insert({
          user_id: user.id,
          prompt,
          emails,
          products,
          email_empresa: email_empresa || 'presupuestos@malagamicro.com',
          request_id,
          status: 'pending'
        });

      if (insertError) {
        console.error('DB insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Error al guardar la solicitud' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send to n8n webhook
      const n8nPayload = {
        request_id,
        user_id: user.id,
        user_email: user.email,
        prompt,
        emails,
        products,
        email_empresa: email_empresa || 'presupuestos@malagamicro.com'
      };

      console.log('Sending to n8n:', n8nPayload);

      try {
        const n8nResponse = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(n8nPayload)
        });

        const n8nData = await n8nResponse.text();
        console.log('n8n response:', n8nResponse.status, n8nData);

        if (!n8nResponse.ok) {
          // Try GET fallback (for n8n test mode)
          const params = new URLSearchParams({
            request_id,
            user_id: user.id,
            prompt
          });
          
          const n8nGetResponse = await fetch(`${n8nWebhookUrl}?${params}`, {
            method: 'GET'
          });

          if (!n8nGetResponse.ok) {
            // Update status to error
            await serviceClient
              .from('budget_requests')
              .update({ status: 'error', response_data: { error: n8nData } })
              .eq('request_id', request_id);

            return new Response(
              JSON.stringify({ error: 'Error al contactar n8n', details: n8nData }),
              { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            request_id,
            message: 'Solicitud enviada correctamente. Recibirás una notificación cuando esté lista para aprobación.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (fetchError) {
        console.error('n8n fetch error:', fetchError);
        
        await serviceClient
          .from('budget_requests')
          .update({ status: 'error', response_data: { error: String(fetchError) } })
          .eq('request_id', request_id);

        return new Response(
          JSON.stringify({ error: 'Error de conexión con n8n' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // APPROVE/REJECT - For approval button actions
    if (req.method === 'POST' && action === 'approve') {
      const body = await req.json();
      const { request_id, approved } = body;

      if (!request_id) {
        return new Response(
          JSON.stringify({ error: 'request_id es requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get webhook waiting URL from n8n
      const n8nBaseUrl = n8nWebhookUrl.replace('/webhook/budget-request', '');
      const approvalUrl = `${n8nBaseUrl}/webhook-waiting/${request_id}`;

      console.log('Sending approval to:', approvalUrl, { approved });

      try {
        const approvalResponse = await fetch(approvalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: approved === true })
        });

        const approvalData = await approvalResponse.text();
        console.log('Approval response:', approvalResponse.status, approvalData);

        // Update status in DB
        const newStatus = approved ? 'approved' : 'rejected';
        await serviceClient
          .from('budget_requests')
          .update({ status: newStatus })
          .eq('request_id', request_id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: approved ? 'Solicitud aprobada' : 'Solicitud rechazada'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (approvalError) {
        console.error('Approval fetch error:', approvalError);
        return new Response(
          JSON.stringify({ error: 'Error al enviar la aprobación' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // LIST REQUESTS - Get user's requests or all for admins
    if (req.method === 'GET' && action === 'list') {
      const { data: requests, error: listError } = await anonClient
        .from('budget_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (listError) {
        return new Response(
          JSON.stringify({ error: 'Error al obtener solicitudes' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ requests }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Acción no válida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Budget request error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
