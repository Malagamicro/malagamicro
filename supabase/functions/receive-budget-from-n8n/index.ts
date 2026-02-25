import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-webhook-secret',
};

/**
 * Webhook endpoint that receives processed budgets from n8n
 * This is called when a provider responds with a budget quote
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('N8N_WEBHOOK_SECRET') || Deno.env.get('WAHA_WEBHOOK_SECRET');

    // Verify webhook secret (mandatory)
    if (!webhookSecret) {
      console.error('N8N_WEBHOOK_SECRET/WAHA_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const providedSecret = req.headers.get('x-webhook-secret') || 
                          req.headers.get('x-api-key') || 
                          req.headers.get('authorization')?.replace('Bearer ', '');
    if (providedSecret !== webhookSecret) {
      console.log('Webhook secret mismatch');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const body = await req.json();
    console.log('Budget received from n8n:', JSON.stringify(body, null, 2));

    const { 
      tipo,
      datos,
      // Direct fields for simpler payloads
      request_id,
      proveedor,
      email_proveedor,
      productos,
      fecha,
      validez,
      observaciones,
      total_general,
      email_original,
      user_responsible_email
    } = body;

    // Handle nested or flat structure
    const budgetData = datos || {
      proveedor,
      email_proveedor,
      productos,
      fecha,
      validez,
      observaciones,
      total_general,
      email_original
    };

    const effectiveRequestId = request_id || budgetData.request_id;

    if (!budgetData.proveedor) {
      return new Response(
        JSON.stringify({ error: 'Campo proveedor es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find responsible user - first try by email, then fall back to admin
    let responsibleUserId: string | null = null;
    
    const { data: users } = await serviceClient.auth.admin.listUsers();
    
    if (user_responsible_email) {
      const responsibleUser = users?.users?.find(u => u.email === user_responsible_email);
      responsibleUserId = responsibleUser?.id || null;
    }
    
    // Fall back to admin user (Inma)
    if (!responsibleUserId) {
      const inmaUser = users?.users?.find(u => 
        u.email?.toLowerCase().includes('inma') || 
        u.email === 'administracion@malagamicro.com'
      );
      responsibleUserId = inmaUser?.id;
    }

    if (!responsibleUserId) {
      // Use first admin user
      const firstUser = users?.users?.[0];
      responsibleUserId = firstUser?.id;
    }

    if (!responsibleUserId) {
      return new Response(
        JSON.stringify({ error: 'No se encontró usuario responsable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse productos if it's a string
    let parsedProductos = budgetData.productos || [];
    if (typeof parsedProductos === 'string') {
      try {
        parsedProductos = JSON.parse(parsedProductos);
      } catch {
        parsedProductos = [{ descripcion: parsedProductos }];
      }
    }

    // Insert the received budget
    const { data: insertedBudget, error: budgetError } = await serviceClient
      .from('budgets_received')
      .insert({
        request_id: effectiveRequestId || `AUTO-${Date.now()}`,
        proveedor: budgetData.proveedor,
        email_proveedor: budgetData.email_proveedor || '',
        productos: parsedProductos,
        total: budgetData.total_general || null,
        observaciones: budgetData.observaciones || '',
        validez: budgetData.validez || '',
        estado: 'revision',
        email_original: budgetData.email_original || '',
        user_responsible: responsibleUserId,
        metadata: { source: 'n8n', received_at: new Date().toISOString() }
      })
      .select('id')
      .single();

    if (budgetError) {
      console.error('Budget insert error:', budgetError);
      return new Response(
        JSON.stringify({ error: 'Error al guardar presupuesto', details: budgetError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to update the original request status if request_id exists
    if (effectiveRequestId) {
      await serviceClient
        .from('budget_requests')
        .update({ status: 'respondido' })
        .eq('request_id', effectiveRequestId);
    }

    // Send notification to responsible user
    await serviceClient
      .from('budget_notifications')
      .insert({
        user_id: responsibleUserId,
        message: `📬 Nuevo presupuesto recibido de ${budgetData.proveedor}${budgetData.total_general ? `: ${budgetData.total_general}€` : ''}`,
        type: 'success',
        request_id: effectiveRequestId,
        metadata: { 
          proveedor: budgetData.proveedor,
          total: budgetData.total_general,
          budget_id: insertedBudget?.id
        }
      });

    // Log the event
    await serviceClient
      .from('workflow_logs')
      .insert({
        level: 'info',
        message: `Presupuesto recibido de ${budgetData.proveedor}`,
        request_id: effectiveRequestId,
        metadata: { 
          budget_id: insertedBudget?.id,
          total: budgetData.total_general
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Presupuesto guardado correctamente',
        budget_id: insertedBudget?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Receive budget error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
