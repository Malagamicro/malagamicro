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
    const apiKey = Deno.env.get('STELORDER_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'STELORDER_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const body = req.method === 'POST' || req.method === 'PUT' ? await req.json().catch(() => null) : null;

    const stelHeaders: Record<string, string> = {
      'APIKEY': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Helper to call STEL API
    const callStel = async (endpoint: string, method = 'GET', payload?: any) => {
      const opts: RequestInit = { method, headers: stelHeaders };
      if (payload && (method === 'POST' || method === 'PUT')) {
        opts.body = JSON.stringify(payload);
      }
      const res = await fetch(`${STEL_API_BASE}/${endpoint}`, opts);
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    };

    // ===== BUDGETS =====

    // LIST BUDGETS
    if (action === 'list-budgets') {
      const page = url.searchParams.get('page') || '1';
      const limit = url.searchParams.get('limit') || '50';
      const search = url.searchParams.get('search') || '';
      
      let endpoint = `budgets?limit=${limit}&page=${page}`;
      if (search) endpoint += `&search=${encodeURIComponent(search)}`;
      
      const result = await callStel(endpoint);
      return new Response(JSON.stringify(result.data), {
        status: result.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET SINGLE BUDGET
    if (action === 'get-budget') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'id requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const result = await callStel(`budgets/${id}`);
      return new Response(JSON.stringify(result.data), {
        status: result.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // CREATE BUDGET
    if (action === 'create-budget') {
      if (!body) {
        return new Response(JSON.stringify({ error: 'Body requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // If no client_id, try to find/create client
      let clientId = body.client_id;
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

      console.log('Creating STEL budget:', JSON.stringify(budgetPayload));
      const result = await callStel('budgets', 'POST', budgetPayload);

      if (!result.ok) {
        console.error('STEL create budget error:', result.data);
        return new Response(JSON.stringify({ error: 'Error al crear presupuesto', details: result.data }), {
          status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, budget: result.data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // UPDATE BUDGET
    if (action === 'update-budget') {
      const id = url.searchParams.get('id');
      if (!id || !body) {
        return new Response(JSON.stringify({ error: 'id y body requeridos' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const result = await callStel(`budgets/${id}`, 'PUT', body);
      if (!result.ok) {
        return new Response(JSON.stringify({ error: 'Error al actualizar', details: result.data }), {
          status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, budget: result.data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // CONVERT BUDGET TO INVOICE
    if (action === 'convert-to-invoice') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'id requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // First get the budget
      const budgetResult = await callStel(`budgets/${id}`);
      if (!budgetResult.ok) {
        return new Response(JSON.stringify({ error: 'Presupuesto no encontrado', details: budgetResult.data }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const budget = budgetResult.data;

      // Create invoice from budget data
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

      console.log('Converting budget to invoice:', JSON.stringify(invoicePayload));
      const invoiceResult = await callStel('invoices', 'POST', invoicePayload);

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

    // CONVERT BUDGET TO ORDER
    if (action === 'convert-to-order') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'id requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const budgetResult = await callStel(`budgets/${id}`);
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

      const orderResult = await callStel('orders', 'POST', orderPayload);

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

    // LIST CLIENTS
    if (action === 'list-clients') {
      const search = url.searchParams.get('search') || '';
      const page = url.searchParams.get('page') || '1';
      let endpoint = `clients?page=${page}&limit=50`;
      if (search) endpoint += `&search=${encodeURIComponent(search)}`;

      const result = await callStel(endpoint);
      return new Response(JSON.stringify(result.data), {
        status: result.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ===== INVOICES =====

    // LIST INVOICES
    if (action === 'list-invoices') {
      const page = url.searchParams.get('page') || '1';
      const result = await callStel(`invoices?page=${page}&limit=50`);
      return new Response(JSON.stringify(result.data), {
        status: result.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // CREATE INVOICE
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

      const result = await callStel('invoices', 'POST', invoicePayload);
      if (!result.ok) {
        return new Response(JSON.stringify({ error: 'Error al crear factura', details: result.data }), {
          status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, invoice: result.data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // DELETE BUDGET
    if (action === 'delete-budget') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'id requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const result = await callStel(`budgets/${id}`, 'DELETE' as any);
      return new Response(JSON.stringify(result.ok ? { success: true } : { error: 'Error al eliminar', details: result.data }), {
        status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET PDF
    if (action === 'get-budget-pdf') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'id requerido' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const result = await callStel(`budgets/${id}/pdf`);
      return new Response(JSON.stringify(result.data), {
        status: result.status,
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
