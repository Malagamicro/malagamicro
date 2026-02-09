import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Circuit breaker: si una API falla 5 veces en 5 minutos, bloquearla temporalmente
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

    const { service_name, action } = await req.json();

    if (!service_name || !action) {
      return new Response(
        JSON.stringify({ error: 'service_name and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (action === 'check') {
      // Verificar si el circuito está abierto
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: recentErrors, error } = await supabase
        .from('workflow_logs')
        .select('id')
        .eq('level', 'error')
        .ilike('message', `%${service_name}%`)
        .gte('created_at', fiveMinutesAgo);

      if (error) throw error;

      const errorCount = recentErrors?.length || 0;
      const isOpen = errorCount >= 5;

      return new Response(
        JSON.stringify({ 
          service: service_name,
          circuit_open: isOpen,
          error_count: errorCount,
          threshold: 5,
          window_minutes: 5,
          message: isOpen 
            ? 'Circuit breaker OPEN - service temporarily disabled' 
            : 'Circuit breaker CLOSED - service operational'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'record_failure') {
      // Registrar fallo
      const { data: logEntry, error: logError } = await supabase
        .from('workflow_logs')
        .insert({
          level: 'error',
          message: `Circuit breaker: ${service_name} failure recorded`,
          metadata: { service_name, timestamp: new Date().toISOString() }
        })
        .select()
        .single();

      if (logError) throw logError;

      // Verificar si ahora el circuito debe abrirse
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentErrors } = await supabase
        .from('workflow_logs')
        .select('id')
        .eq('level', 'error')
        .ilike('message', `%${service_name}%`)
        .gte('created_at', fiveMinutesAgo);

      const errorCount = recentErrors?.length || 0;
      const isOpen = errorCount >= 5;

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Failure recorded',
          log_id: logEntry.id,
          current_error_count: errorCount,
          circuit_open: isOpen
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'reset') {
      // Reset manual del circuit breaker (marcar errores antiguos como resueltos)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: updated, error: updateError } = await supabase
        .from('workflow_logs')
        .update({ level: 'info', message: `[RESET] Circuit breaker reset for: ${service_name}` })
        .eq('level', 'error')
        .ilike('message', `%${service_name}%`)
        .gte('created_at', fiveMinutesAgo)
        .select();

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Circuit breaker reset',
          errors_cleared: updated?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use: check, record_failure, or reset' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in circuit breaker:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
