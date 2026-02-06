import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Sends an approved budget to STEL Order API
 * This creates an invoice or budget/quote in STEL Order
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stelApiKey = Deno.env.get('STELORDER_API_KEY');

    if (!stelApiKey) {
      return new Response(
        JSON.stringify({ error: 'STELORDER_API_KEY no configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    const { budget_id, customer_id, create_type = 'budget' } = body;

    if (!budget_id) {
      return new Response(
        JSON.stringify({ error: 'budget_id es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the budget from database
    const { data: budget, error: fetchError } = await serviceClient
      .from('budgets_received')
      .select('*')
      .eq('id', budget_id)
      .single();

    if (fetchError || !budget) {
      return new Response(
        JSON.stringify({ error: 'Presupuesto no encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEL Order API configuration
    const STEL_API_BASE = 'https://api.stelorder.com/v2';
    const stelHeaders = {
      'Authorization': `Bearer ${stelApiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Search or create client in STEL Order
    let clientId = customer_id;
    
    if (!clientId && budget.proveedor) {
      // Search for existing client
      const searchResponse = await fetch(
        `${STEL_API_BASE}/clients?search=${encodeURIComponent(budget.proveedor)}`,
        { method: 'GET', headers: stelHeaders }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
          clientId = searchData.data[0].id;
        }
      }

      // Create client if not found
      if (!clientId) {
        const createClientResponse = await fetch(`${STEL_API_BASE}/clients`, {
          method: 'POST',
          headers: stelHeaders,
          body: JSON.stringify({
            name: budget.proveedor,
            email: budget.email_proveedor || '',
            type: 'company'
          })
        });

        if (createClientResponse.ok) {
          const clientData = await createClientResponse.json();
          clientId = clientData.id;
        }
      }
    }

    // Prepare items from productos
    const productos = Array.isArray(budget.productos) ? budget.productos : [];
    const items = productos.map((p: any) => ({
      description: p.descripcion || p.nombre || 'Producto',
      quantity: p.cantidad || 1,
      unit_price: p.precio_unitario || p.precio || 0,
      tax_rate: p.iva || 21
    }));

    // Build payload
    const stelPayload = {
      client_id: clientId,
      items,
      notes: budget.observaciones || `Presupuesto de ${budget.proveedor}`,
      valid_until: budget.validez || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    console.log('Sending to STEL Order:', stelPayload);

    // Create budget or invoice
    const endpoint = create_type === 'invoice' ? 'invoices' : 'budgets';
    const stelResponse = await fetch(`${STEL_API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: stelHeaders,
      body: JSON.stringify(stelPayload)
    });

    const stelData = await stelResponse.json();
    console.log('STEL Order response:', stelResponse.status, stelData);

    if (!stelResponse.ok) {
      // Log the error
      await serviceClient
        .from('workflow_logs')
        .insert({
          level: 'error',
          message: `Error al enviar a STEL Order: ${JSON.stringify(stelData)}`,
          request_id: budget.request_id,
          metadata: { budget_id, stel_error: stelData }
        });

      return new Response(
        JSON.stringify({ 
          error: 'Error al crear en STEL Order', 
          details: stelData 
        }),
        { status: stelResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update budget with STEL Order ID
    const updateField = create_type === 'invoice' ? 'invoice_id' : 'stel_budget_id';
    await serviceClient
      .from('budgets_received')
      .update({ 
        [updateField]: stelData.id,
        estado: 'enviado_stel',
        selected: true
      })
      .eq('id', budget_id);

    // Create notification
    await serviceClient
      .from('budget_notifications')
      .insert({
        user_id: user.id,
        message: `✅ ${create_type === 'invoice' ? 'Factura' : 'Presupuesto'} creado en STEL Order: ${budget.proveedor}`,
        type: 'success',
        request_id: budget.request_id,
        metadata: { 
          stel_id: stelData.id,
          budget_id
        }
      });

    // Log success
    await serviceClient
      .from('workflow_logs')
      .insert({
        level: 'info',
        message: `${create_type === 'invoice' ? 'Factura' : 'Presupuesto'} creado en STEL Order`,
        request_id: budget.request_id,
        metadata: { 
          stel_id: stelData.id,
          budget_id,
          user_email: user.email
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        stel_id: stelData.id,
        message: `${create_type === 'invoice' ? 'Factura' : 'Presupuesto'} creado correctamente en STEL Order`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Send to STEL Order error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
