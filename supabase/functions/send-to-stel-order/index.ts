import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Correct STEL Order API v1 base URL
const STEL_API_BASE = 'https://app.stelorder.com/api/v1';

// Map REST resource paths to their required root JSON key for POST/PUT
const ROOT_KEY_MAP: Record<string, string> = {
  'est_quotes': 'est_quote',
  'est_ordinary_invoices': 'est_ordinary_invoice',
  'est_sales_orders': 'est_sales_order',
  'clients': 'client',
};

function getRootKey(endpoint: string): string | null {
  for (const [path, key] of Object.entries(ROOT_KEY_MAP)) {
    if (endpoint.startsWith(path)) return key;
  }
  return null;
}

// deno-lint-ignore no-explicit-any
async function stelFetch(endpoint: string, method: string, apiKey: string, payload?: any) {
  const fullUrl = `${STEL_API_BASE}/${endpoint}`;
  console.log(`[STEL] ${method} ${fullUrl}`);

  // deno-lint-ignore no-explicit-any
  const opts: any = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  if (payload && (method === 'POST' || method === 'PUT')) {
    const rootKey = getRootKey(endpoint);
    const wrappedPayload = rootKey ? { [rootKey]: payload } : payload;
    console.log('[STEL] Payload:', JSON.stringify(wrappedPayload));
    opts.body = JSON.stringify(wrappedPayload);
  }

  const res = await fetch(fullUrl, opts);
  const text = await res.text();
  // deno-lint-ignore no-explicit-any
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok || data?.error_code) {
    console.error(`[STEL] Error ${res.status}:`, JSON.stringify(data));
    if (data?.error_code === 'E000003') {
      console.error('[STEL] E000003: Authentication error or incorrect endpoint.');
    }
  }

  return { ok: res.ok && !data?.error_code, status: res.status, data };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stelApiKey = (Deno.env.get('STELORDER_API_KEY') || '').trim();

    if (!stelApiKey) {
      return new Response(
        JSON.stringify({ error: 'STELORDER_API_KEY no configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Search or create client in STEL Order
    let clientId = customer_id;
    
    if (!clientId && budget.proveedor) {
      const searchResult = await stelFetch(
        'clients?search=' + encodeURIComponent(budget.proveedor), 'GET', stelApiKey
      );

      if (searchResult.ok && Array.isArray(searchResult.data) && searchResult.data.length > 0) {
        clientId = searchResult.data[0].id;
      }

      if (!clientId) {
        const createResult = await stelFetch('clients', 'POST', stelApiKey, {
          name: budget.proveedor,
          email: budget.email_proveedor || '',
          commercialName: budget.proveedor,
        });

        if (createResult.ok) clientId = createResult.data.id;
      }
    }

    // deno-lint-ignore no-explicit-any
    const productos = Array.isArray(budget.productos) ? budget.productos : [];
    // deno-lint-ignore no-explicit-any
    const lines = productos.map((p: any) => ({
      concept: p.descripcion || p.nombre || 'Producto',
      quantity: p.cantidad || 1,
      price: p.precio_unitario || p.precio || 0,
      taxPercentage: p.iva || 21,
      discount: 0,
    }));

    const stelPayload = {
      clientId: clientId,
      lines,
      notes: budget.observaciones || 'Presupuesto de ' + budget.proveedor,
      validUntil: budget.validez || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    // Use correct REST endpoints
    const endpoint = create_type === 'invoice' ? 'est_ordinary_invoices' : 'est_quotes';
    const stelResult = await stelFetch(endpoint, 'POST', stelApiKey, stelPayload);

    console.log('STEL Order response:', stelResult.status, JSON.stringify(stelResult.data));

    if (!stelResult.ok) {
      await serviceClient
        .from('workflow_logs')
        .insert({
          level: 'error',
          message: 'Error al enviar a STEL Order: ' + JSON.stringify(stelResult.data),
          request_id: budget.request_id,
          metadata: { budget_id, stel_error: stelResult.data }
        });

      return new Response(
        JSON.stringify({ error: 'Error al crear en STEL Order', details: stelResult.data }),
        { status: stelResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updateField = create_type === 'invoice' ? 'invoice_id' : 'stel_budget_id';
    await serviceClient
      .from('budgets_received')
      .update({ 
        [updateField]: String(stelResult.data.id),
        estado: 'enviado_stel',
        selected: true
      })
      .eq('id', budget_id);

    await serviceClient
      .from('budget_notifications')
      .insert({
        user_id: user.id,
        message: '✅ ' + (create_type === 'invoice' ? 'Factura' : 'Presupuesto') + ' creado en STEL Order: ' + budget.proveedor,
        type: 'success',
        request_id: budget.request_id,
        metadata: { stel_id: stelResult.data.id, budget_id }
      });

    await serviceClient
      .from('workflow_logs')
      .insert({
        level: 'info',
        message: (create_type === 'invoice' ? 'Factura' : 'Presupuesto') + ' creado en STEL Order',
        request_id: budget.request_id,
        metadata: { stel_id: stelResult.data.id, budget_id }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        stel_id: stelResult.data.id,
        message: (create_type === 'invoice' ? 'Factura' : 'Presupuesto') + ' creado correctamente en STEL Order'
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
