import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Notifies n8n when a user approves or rejects a budget
 * This allows n8n to continue the workflow based on user action
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const n8nWebhookUrl = Deno.env.get('N8N_WEBHOOK_URL');

    // Verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const body = await req.json();
    const { budget_id, request_id, accion, enviar_stel = false } = body;

    if (!budget_id && !request_id) {
      return new Response(
        JSON.stringify({ error: 'budget_id o request_id es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!accion || !['aprobar', 'rechazar'].includes(accion)) {
      return new Response(
        JSON.stringify({ error: 'accion debe ser "aprobar" o "rechazar"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get budget data if budget_id provided
    let budgetData = null;
    if (budget_id) {
      const { data, error } = await serviceClient
        .from('budgets_received')
        .select('*')
        .eq('id', budget_id)
        .single();
      
      if (!error) {
        budgetData = data;
      }
    }

    // Update budget status
    const newStatus = accion === 'aprobar' ? 'aprobado' : 'rechazado';
    
    if (budget_id) {
      await serviceClient
        .from('budgets_received')
        .update({ 
          estado: newStatus,
          selected: accion === 'aprobar'
        })
        .eq('id', budget_id);
    }

    // Update request status if request_id provided
    const effectiveRequestId = request_id || budgetData?.request_id;
    if (effectiveRequestId) {
      await serviceClient
        .from('budget_requests')
        .update({ status: accion === 'aprobar' ? 'approved' : 'rejected' })
        .eq('request_id', effectiveRequestId);
    }

    // Notify n8n if webhook URL is configured
    if (n8nWebhookUrl) {
      const n8nPayload = {
        accion,
        enviar_stel,
        budget_id,
        request_id: effectiveRequestId,
        presupuesto: budgetData,
        approved_by: user.email,
        approved_at: new Date().toISOString()
      };

      console.log('Notifying n8n:', n8nPayload);

      try {
        // Try the approval webhook endpoint
        const approvalUrl = `${n8nWebhookUrl}/presupuesto-aprobado`;
        const n8nResponse = await fetch(approvalUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(n8nPayload)
        });

        console.log('n8n response:', n8nResponse.status);
      } catch (n8nError) {
        console.error('Error notifying n8n:', n8nError);
        // Don't fail the request if n8n notification fails
      }
    }

    // Log the action
    await serviceClient
      .from('workflow_logs')
      .insert({
        level: 'info',
        message: `Presupuesto ${accion === 'aprobar' ? 'aprobado' : 'rechazado'} por ${user.email}`,
        request_id: effectiveRequestId,
        metadata: { 
          budget_id,
          accion,
          enviar_stel,
          user_email: user.email
        }
      });

    // Create notification for the action
    const message = accion === 'aprobar' 
      ? `✅ Presupuesto aprobado${enviar_stel ? ' y enviado a STEL Order' : ''}`
      : `❌ Presupuesto rechazado`;

    await serviceClient
      .from('budget_notifications')
      .insert({
        user_id: user.id,
        message,
        type: accion === 'aprobar' ? 'success' : 'warning',
        request_id: effectiveRequestId,
        metadata: { budget_id, accion }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Presupuesto ${accion === 'aprobar' ? 'aprobado' : 'rechazado'} correctamente`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Notify n8n approval error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
