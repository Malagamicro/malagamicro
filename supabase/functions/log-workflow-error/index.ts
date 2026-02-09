import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get('N8N_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('x-webhook-secret');
    
    if (webhookSecret && providedSecret !== webhookSecret) {
      throw new Error('Unauthorized');
    }

    const { 
      workflow_id, 
      workflow_name, 
      execution_id,
      node_name,
      error_message, 
      error_stack,
      input_data,
      level = 'error',
      request_id,
      metadata 
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Guardar en tabla de logs
    const { data: logEntry, error: logError } = await supabase
      .from('workflow_logs')
      .insert({
        level,
        message: `[${workflow_name || 'Unknown'}] ${node_name || 'Unknown'}: ${error_message}`,
        error_details: error_stack || null,
        request_id: request_id || null,
        node_error: node_name || null,
        metadata: {
          workflow_id,
          execution_id,
          input_data: input_data ? JSON.parse(JSON.stringify(input_data).substring(0, 5000)) : null,
          ...metadata
        }
      })
      .select()
      .single();

    if (logError) throw logError;

    // Si es crítico, añadir a cola de reintentos
    if (level === 'error' && (metadata?.retry_count || 0) < 3) {
      await supabase.from('n8n_queue').insert({
        task_type: 'retry_failed_workflow',
        payload: {
          workflow_id,
          execution_id,
          request_id,
          retry_count: (metadata?.retry_count || 0) + 1
        },
        priority: 9,
        scheduled_for: new Date(Date.now() + Math.pow(2, metadata?.retry_count || 0) * 2000).toISOString()
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        log_id: logEntry.id,
        message: 'Error logged successfully' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error logging workflow error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
