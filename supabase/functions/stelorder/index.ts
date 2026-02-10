import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const STEL_API_BASE = 'https://app.stelorder.com/app';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = (Deno.env.get('STELORDER_API_KEY') || '').trim();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'STELORDER_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`STEL API Key: "${apiKey}" (length: ${apiKey.length})`);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const body = req.method === 'POST' || req.method === 'PUT' ? await req.json().catch(() => null) : null;

    const callStel = async (endpoint: string, method = 'GET', payload?: any) => {
      // Try both methods: header AND query parameter
      const separator = endpoint.includes('?') ? '&' : '?';
      const fullUrl = `${STEL_API_BASE}/${endpoint}${separator}APIKEY=${encodeURIComponent(apiKey)}`;
      console.log(`STEL full URL: ${fullUrl}`);
      
      const opts: RequestInit = { 
        method, 
        headers: {
          'APIKEY': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };
      if (payload && (method === 'POST' || method === 'PUT')) {
        opts.body = JSON.stringify(payload);
      }
      console.log(`STEL API call: ${method} ${STEL_API_BASE}/${endpoint}`);
      const res = await fetch(fullUrl, opts);
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (!res.ok) console.error(`STEL API error ${res.status}:`, JSON.stringify(data));
      return { ok: res.ok, status: res.status, data };
    };

    // ===== BUDGETS (salesEstimates) =====

    if (action === 'list-budgets') {
      const page = url.searchParams.get('page') || '1';
      const limit = url.searchParams.get('limit') || '50';
      const search = url.searchParams.get('search') || '';
      
      let endpoint = `salesEstimates?limit=${limit}&page=${page}`;
      if (search && search.trim().length > 0) endpoint += `&search=${encodeURIComponent(search)}`;
      
      const result = await callStel(endpoint);
      return new Response(JSON.stringify(result.data), {
        status: result.ok ? 200 : result.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get-budget') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'id requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const result = await callStel(`salesEstimates/${id}`);
      return new Response(JSON.stringify(result.data), {
        status: result.ok ? 200 : result.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'create-budget') {
      if (!body) {
        return new Response(JSON.stringify({ error: 'Body requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let clientId = body.client_id || body.clientId;
      if (!clientId && body.client_name) {
        const searchResult = await callStel(`clients?search=${encodeURIComponent(body.client_name)}`);
        if (searchResult.ok && Array.isArray(searchResult.data) && searchResult.data.length > 0) {
          clientId = searchResult.data[0].id;
        } else {
          const createResult = await callStel('clients', 'POST', {
            name: body.client_name,
            email: body.client_email || '',
            commercialName: body.client_name,
          });
          if (createResult.ok) clientId = createResult.data.id;
        }
      }

      const budgetPayload: any = {
        clientId: clientId,
        lines: (body.items || body.lines || []).map((item: any) => ({
          concept: item.concept || item.description || item.nombre || 'Producto',
          quantity: item.quantity || item.cantidad || 1,
          price: item.price || item.unit_price || item.precio || 0,
          taxPercentage: item.taxPercentage || item.tax_rate || 21,
          discount: item.discount || 0,
        })),
        notes: body.notes || '',
        validUntil: body.valid_until || body.validUntil || undefined,
      };

      if (body.subject) budgetPayload.subject = body.subject;

      console.log('Creating STEL salesEstimate:', JSON.stringify(budgetPayload));
      const result = await callStel('salesEstimates', 'POST', budgetPayload);

      if (!result.ok) {
        return new Response(JSON.stringify({ error: 'Error al crear presupuesto', details: result.data }), {
          status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, budget: result.data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'update-budget') {
      const id = url.searchParams.get('id');
      if (!id || !body) {
        return new Response(JSON.stringify({ error: 'id y body requeridos' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const result = await callStel(`salesEstimates/${id}`, 'PUT', body);
      if (!result.ok) {
        return new Response(JSON.stringify({ error: 'Error al actualizar', details: result.data }), {
          status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, budget: result.data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'delete-budget') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'id requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const result = await callStel(`salesEstimates/${id}`, 'DELETE' as any);
      return new Response(JSON.stringify(result.ok ? { success: true } : { error: 'Error al eliminar', details: result.data }), {
        status: result.ok ? 200 : result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get-budget-pdf') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'id requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const result = await callStel(`salesEstimates/${id}/pdf`);
      return new Response(JSON.stringify(result.data), {
        status: result.ok ? 200 : result.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== CONVERT =====

    if (action === 'convert-to-invoice') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'id requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const budgetResult = await callStel(`salesEstimates/${id}`);
      if (!budgetResult.ok) {
        return new Response(JSON.stringify({ error: 'Presupuesto no encontrado', details: budgetResult.data }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const budget = budgetResult.data;
      const invoicePayload: any = {
        clientId: budget.clientId || budget.client?.id,
        lines: (budget.lines || []).map((line: any) => ({
          concept: line.concept || line.description,
          quantity: line.quantity || 1,
          price: line.price || line.unitPrice || 0,
          taxPercentage: line.taxPercentage || 21,
          discount: line.discount || 0,
        })),
        notes: budget.notes || `Generado desde presupuesto #${budget.number || id}`,
      };

      const invoiceResult = await callStel('ordinaryInvoices', 'POST', invoicePayload);

      if (!invoiceResult.ok) {
        return new Response(JSON.stringify({ error: 'Error al crear factura', details: invoiceResult.data }), {
          status: invoiceResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        invoice: invoiceResult.data,
        message: `Factura creada desde presupuesto #${budget.number || id}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'convert-to-order') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'id requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const budgetResult = await callStel(`salesEstimates/${id}`);
      if (!budgetResult.ok) {
        return new Response(JSON.stringify({ error: 'Presupuesto no encontrado' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const budget = budgetResult.data;
      const orderPayload: any = {
        clientId: budget.clientId || budget.client?.id,
        lines: (budget.lines || []).map((line: any) => ({
          concept: line.concept || line.description,
          quantity: line.quantity || 1,
          price: line.price || line.unitPrice || 0,
          taxPercentage: line.taxPercentage || 21,
          discount: line.discount || 0,
        })),
        notes: budget.notes || `Generado desde presupuesto #${budget.number || id}`,
      };

      const orderResult = await callStel('salesOrders', 'POST', orderPayload);

      if (!orderResult.ok) {
        return new Response(JSON.stringify({ error: 'Error al crear pedido', details: orderResult.data }), {
          status: orderResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        order: orderResult.data,
        message: `Pedido creado desde presupuesto #${budget.number || id}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== CLIENTS =====

    if (action === 'list-clients') {
      const search = url.searchParams.get('search') || '';
      const page = url.searchParams.get('page') || '1';
      let endpoint = `clients?page=${page}&limit=50`;
      if (search && search.trim().length > 0) endpoint += `&search=${encodeURIComponent(search)}`;

      const result = await callStel(endpoint);
      return new Response(JSON.stringify(result.data), {
        status: result.ok ? 200 : result.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== INVOICES (ordinaryInvoices) =====

    if (action === 'list-invoices') {
      const page = url.searchParams.get('page') || '1';
      const result = await callStel(`ordinaryInvoices?page=${page}&limit=50`);
      return new Response(JSON.stringify(result.data), {
        status: result.ok ? 200 : result.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'create-invoice') {
      if (!body) {
        return new Response(JSON.stringify({ error: 'Body requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let clientId = body.client_id || body.clientId;
      if (!clientId && body.client_name) {
        const searchResult = await callStel(`clients?search=${encodeURIComponent(body.client_name)}`);
        if (searchResult.ok && Array.isArray(searchResult.data) && searchResult.data.length > 0) {
          clientId = searchResult.data[0].id;
        }
      }

      const invoicePayload = {
        clientId,
        lines: (body.items || body.lines || []).map((item: any) => ({
          concept: item.concept || item.description || item.nombre,
          quantity: item.quantity || item.cantidad || 1,
          price: item.price || item.unit_price || item.precio || 0,
          taxPercentage: item.taxPercentage || item.tax_rate || 21,
          discount: item.discount || 0,
        })),
        notes: body.notes || '',
      };

      const result = await callStel('ordinaryInvoices', 'POST', invoicePayload);
      if (!result.ok) {
        return new Response(JSON.stringify({ error: 'Error al crear factura', details: result.data }), {
          status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, invoice: result.data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(
      JSON.stringify({ 
        error: 'Acción no válida',
        available_actions: [
          'list-budgets', 'get-budget', 'create-budget', 'update-budget', 'delete-budget', 'get-budget-pdf',
          'convert-to-invoice', 'convert-to-order',
          'list-clients', 'list-invoices', 'create-invoice'
        ]
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('STEL Order error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});