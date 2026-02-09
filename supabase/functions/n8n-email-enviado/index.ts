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

    const { presupuesto_id, request_id, proveedor_email, email_message_id, timestamp } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Obtener user_id del presupuesto
    const { data: budgetData } = await supabase
      .from('budget_requests')
      .select('user_id')
      .eq('id', presupuesto_id)
      .single();

    // Actualizar estado del presupuesto
    const { error: updateError } = await supabase
      .from('budget_requests')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
        response_data: {
          email_sent: true,
          message_id: email_message_id,
          provider: proveedor_email,
          sent_at: timestamp
        }
      })
      .eq('id', presupuesto_id);

    if (updateError) throw updateError;

    // Crear notificación
    if (budgetData?.user_id) {
      await supabase.from('budget_notifications').insert({
        user_id: budgetData.user_id,
        message: `Email enviado a ${proveedor_email} para solicitud ${request_id}`,
        type: 'success',
        request_id: request_id,
        metadata: { email_message_id, timestamp, proveedor_email }
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Email registrado correctamente' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
