import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const STEL_API_BASE = 'https://app.stelorder.com/app';

// Map endpoint paths to their required root JSON key for POST/PUT
// deno-lint-ignore no-explicit-any
const ROOT_KEY_MAP: Record<string, string> = {
  'salesEstimates': 'est_quote',
  'ordinaryInvoices': 'est_ordinary_invoice',
  'salesOrders': 'est_sales_order',
  'clients': 'client',
  'contacts': 'contact',
  'products': 'product',
  'services': 'service',
  'suppliers': 'supplier',
  'potentialClients': 'potential_client',
};

function getRootKey(endpoint: string): string | null {
  for (const [path, key] of Object.entries(ROOT_KEY_MAP)) {
    if (endpoint.startsWith(path)) return key;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = (Deno.env.get('STELORDER_API_KEY') || '').trim();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'STELORDER_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const rawSearch = url.searchParams.get('search') || '';
    const sanitizedSearch = rawSearch && !rawSearch.includes('/') && !rawSearch.includes('.ts') ? rawSearch.trim() : '';
    
    // deno-lint-ignore no-explicit-any
    let body: any = null;
    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        body = await req.json();
      } catch {
        // no body
      }
    }

    // deno-lint-ignore no-explicit-any
    function respond(data: any, status = 200) {
      return new Response(JSON.stringify(data),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // deno-lint-ignore no-explicit-any
    async function stelFetch(endpoint: string, method = 'GET', payload?: any) {
      const sep = endpoint.includes('?') ? '&' : '?';
      const fullUrl = STEL_API_BASE + '/' + endpoint + sep + 'APIKEY=' + encodeURIComponent(apiKey);
      console.log('[STEL] ' + method + ' ' + STEL_API_BASE + '/' + endpoint);
      
      // deno-lint-ignore no-explicit-any
      const opts: any = { method, headers: { 'APIKEY': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
      if (payload && (method === 'POST' || method === 'PUT')) {
        // Wrap payload in root key if required by STEL Order API
        const rootKey = getRootKey(endpoint);
        const wrappedPayload = rootKey ? { [rootKey]: payload } : payload;
        console.log('[STEL] Payload:', JSON.stringify(wrappedPayload));
        opts.body = JSON.stringify(wrappedPayload);
      }
      
      const res = await fetch(fullUrl, opts);
      const text = await res.text();
      // deno-lint-ignore no-explicit-any
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
      if (!res.ok) console.error('[STEL] Error ' + res.status + ':', JSON.stringify(data));
      return { ok: res.ok, status: res.status, data };
    }

    // deno-lint-ignore no-explicit-any
    function mapLine(item: any) {
      return {
        concept: item.concept || item.description || item.nombre || 'Producto',
        quantity: item.quantity || item.cantidad || 1,
        price: item.price || item.unit_price || item.precio || 0,
        taxPercentage: item.taxPercentage || item.tax_rate || 21,
        discount: item.discount || 0,
      };
    }

    if (action === 'test-connection') {
      const result = await stelFetch('clients?limit=1');
      return respond({ connected: result.ok, status: result.status, data: result.data, apiKeyLength: apiKey.length });
    }

    if (action === 'list-budgets') {
      const page = url.searchParams.get('page') || '1';
      const limit = url.searchParams.get('limit') || '50';
      let ep = 'salesEstimates?limit=' + limit + '&page=' + page;
      if (sanitizedSearch) ep += '&search=' + encodeURIComponent(sanitizedSearch);
      const r = await stelFetch(ep);
      return respond(r.data, r.ok ? 200 : r.status);
    }

    if (action === 'get-budget') {
      const id = url.searchParams.get('id');
      if (!id) return respond({ error: 'id requerido' }, 400);
      const r = await stelFetch('salesEstimates/' + id);
      return respond(r.data, r.ok ? 200 : r.status);
    }

    if (action === 'create-budget') {
      if (!body) return respond({ error: 'Body requerido' }, 400);

      let clientId = body.client_id || body.clientId;
      if (!clientId && body.client_name) {
        const sr = await stelFetch('clients?search=' + encodeURIComponent(body.client_name));
        if (sr.ok && Array.isArray(sr.data) && sr.data.length > 0) {
          clientId = sr.data[0].id;
        } else {
          const cr = await stelFetch('clients', 'POST', { name: body.client_name, email: body.client_email || '', commercialName: body.client_name });
          if (cr.ok) clientId = cr.data.id;
        }
      }

      // deno-lint-ignore no-explicit-any
      const payload: any = {
        clientId: clientId,
        // deno-lint-ignore no-explicit-any
        lines: (body.items || body.lines || []).map((i: any) => mapLine(i)),
        notes: body.notes || '',
        validUntil: body.valid_until || body.validUntil || undefined,
      };
      if (body.subject) payload.subject = body.subject;

      const r = await stelFetch('salesEstimates', 'POST', payload);
      if (!r.ok) return respond({ error: 'Error al crear presupuesto', details: r.data }, r.status);
      return respond({ success: true, budget: r.data });
    }

    if (action === 'update-budget') {
      const id = url.searchParams.get('id');
      if (!id || !body) return respond({ error: 'id y body requeridos' }, 400);
      const r = await stelFetch('salesEstimates/' + id, 'PUT', body);
      if (!r.ok) return respond({ error: 'Error al actualizar', details: r.data }, r.status);
      return respond({ success: true, budget: r.data });
    }

    if (action === 'delete-budget') {
      const id = url.searchParams.get('id');
      if (!id) return respond({ error: 'id requerido' }, 400);
      const r = await stelFetch('salesEstimates/' + id, 'DELETE');
      return respond(r.ok ? { success: true } : { error: 'Error al eliminar', details: r.data }, r.ok ? 200 : r.status);
    }

    if (action === 'get-budget-pdf') {
      const id = url.searchParams.get('id');
      if (!id) return respond({ error: 'id requerido' }, 400);
      const r = await stelFetch('salesEstimates/' + id + '/pdf');
      return respond(r.data, r.ok ? 200 : r.status);
    }

    if (action === 'convert-to-invoice') {
      const id = url.searchParams.get('id');
      if (!id) return respond({ error: 'id requerido' }, 400);
      const br = await stelFetch('salesEstimates/' + id);
      if (!br.ok) return respond({ error: 'Presupuesto no encontrado', details: br.data }, 404);
      const b = br.data;
      const ip = {
        clientId: b.clientId || (b.client && b.client.id),
        // deno-lint-ignore no-explicit-any
        lines: (b.lines || []).map((l: any) => ({ concept: l.concept || l.description, quantity: l.quantity || 1, price: l.price || l.unitPrice || 0, taxPercentage: l.taxPercentage || 21, discount: l.discount || 0 })),
        notes: b.notes || 'Generado desde presupuesto #' + (b.number || id),
      };
      const ir = await stelFetch('ordinaryInvoices', 'POST', ip);
      if (!ir.ok) return respond({ error: 'Error al crear factura', details: ir.data }, ir.status);
      return respond({ success: true, invoice: ir.data, message: 'Factura creada desde presupuesto #' + (b.number || id) });
    }

    if (action === 'convert-to-order') {
      const id = url.searchParams.get('id');
      if (!id) return respond({ error: 'id requerido' }, 400);
      const br = await stelFetch('salesEstimates/' + id);
      if (!br.ok) return respond({ error: 'Presupuesto no encontrado' }, 404);
      const b = br.data;
      const op = {
        clientId: b.clientId || (b.client && b.client.id),
        // deno-lint-ignore no-explicit-any
        lines: (b.lines || []).map((l: any) => ({ concept: l.concept || l.description, quantity: l.quantity || 1, price: l.price || l.unitPrice || 0, taxPercentage: l.taxPercentage || 21, discount: l.discount || 0 })),
        notes: b.notes || 'Generado desde presupuesto #' + (b.number || id),
      };
      const or2 = await stelFetch('salesOrders', 'POST', op);
      if (!or2.ok) return respond({ error: 'Error al crear pedido', details: or2.data }, or2.status);
      return respond({ success: true, order: or2.data, message: 'Pedido creado desde presupuesto #' + (b.number || id) });
    }

    if (action === 'list-clients') {
      const page = url.searchParams.get('page') || '1';
      let ep = 'clients?page=' + page + '&limit=50';
      if (sanitizedSearch) ep += '&search=' + encodeURIComponent(sanitizedSearch);
      const r = await stelFetch(ep);
      return respond(r.data, r.ok ? 200 : r.status);
    }

    if (action === 'list-invoices') {
      const page = url.searchParams.get('page') || '1';
      const r = await stelFetch('ordinaryInvoices?page=' + page + '&limit=50');
      return respond(r.data, r.ok ? 200 : r.status);
    }

    if (action === 'create-invoice') {
      if (!body) return respond({ error: 'Body requerido' }, 400);
      let clientId = body.client_id || body.clientId;
      if (!clientId && body.client_name) {
        const sr = await stelFetch('clients?search=' + encodeURIComponent(body.client_name));
        if (sr.ok && Array.isArray(sr.data) && sr.data.length > 0) clientId = sr.data[0].id;
      }
      const ip = {
        clientId,
        // deno-lint-ignore no-explicit-any
        lines: (body.items || body.lines || []).map((i: any) => mapLine(i)),
        notes: body.notes || '',
      };
      const r = await stelFetch('ordinaryInvoices', 'POST', ip);
      if (!r.ok) return respond({ error: 'Error al crear factura', details: r.data }, r.status);
      return respond({ success: true, invoice: r.data });
    }

    return respond({
      error: 'Acción no válida',
      available_actions: ['list-budgets', 'get-budget', 'create-budget', 'update-budget', 'delete-budget', 'get-budget-pdf', 'convert-to-invoice', 'convert-to-order', 'list-clients', 'list-invoices', 'create-invoice', 'test-connection']
    }, 400);

  } catch (error) {
    console.error('[STEL] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});