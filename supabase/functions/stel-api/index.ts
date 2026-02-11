import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Official STEL Order API base URL (per docs: https://app.stelorder.com/app/indexapi.html)
const STEL_API_BASE = 'https://app.stelorder.com/app';

// Map endpoint paths to their required root JSON key for POST/PUT
const ROOT_KEY_MAP: Record<string, string> = {
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
    // Clean APIKEY: remove braces, quotes, whitespace (STEL docs say "Do not include {}")
    const rawKey = Deno.env.get('STELORDER_API_KEY') || '';
    const apiKey = rawKey.replace(/[{}"'\s]/g, '');
    console.log(`[STEL] APIKEY length: ${apiKey.length}, first4: ${apiKey.substring(0, 4)}..., raw length: ${rawKey.length}`);
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
      // Auth: APIKEY as query param AND header (per STEL docs)
      const sep = endpoint.includes('?') ? '&' : '?';
      const fullUrl = `${STEL_API_BASE}/${endpoint}${sep}APIKEY=${encodeURIComponent(apiKey)}`;
      console.log(`[STEL] ${method} ${STEL_API_BASE}/${endpoint}`);
      
      // deno-lint-ignore no-explicit-any
      const opts: any = {
        method,
        headers: {
          'APIKEY': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      };

      if (payload && (method === 'POST' || method === 'PUT')) {
        // Wrap payload in root key as required by STEL Order API
        const rootKey = getRootKey(endpoint);
        const wrappedPayload = rootKey ? { [rootKey]: payload } : payload;
        console.log('[STEL] Sending body:', JSON.stringify(wrappedPayload));
        opts.body = JSON.stringify(wrappedPayload);
      }
      
      const res = await fetch(fullUrl, opts);
      const text = await res.text();
      // deno-lint-ignore no-explicit-any
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        // If response is HTML, it means wrong endpoint or auth issue
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          console.error('[STEL] Received HTML instead of JSON - likely wrong endpoint or auth issue');
          data = { error: 'STEL returned HTML instead of JSON', error_code: 'E000003' };
          return { ok: false, status: 401, data };
        }
        data = { raw: text };
      }

      // Handle specific STEL error codes
      if (!res.ok || data?.error_code) {
        console.error(`[STEL] Error ${res.status}:`, JSON.stringify(data));
        if (data?.error_code === 'E000003') {
          console.error('[STEL] E000003: Missing root JSON key or auth error. Verify APIKEY and payload structure.');
        }
      }

      return { ok: res.ok && !data?.error_code, status: res.status, data };
    }

    // deno-lint-ignore no-explicit-any
    function mapLine(item: any) {
      return {
        'line-type': item['line-type'] || item.lineType || 'ITEM',
        reference: item.reference || item.referencia || '',
        name: item.name || item.nombre || item.concept || 'Producto',
        description: item.description || item.descripcion || '',
        'base-price': item['base-price'] || item.base_price || item.price || item.precio || 0,
        units: item.units || item.quantity || item.cantidad || 1,
        'discount-percentage': item['discount-percentage'] || item.discount || item.descuento || 0,
      };
    }

    if (action === 'test-connection') {
      const result = await stelFetch('clients?limit=1');
      return respond({ connected: result.ok, status: result.status, data: result.data, apiKeyLength: apiKey.length });
    }

    if (action === 'list-budgets') {
      const page = url.searchParams.get('page') || '1';
      const limit = url.searchParams.get('limit') || '50';
      let ep = `salesEstimates?limit=${limit}&page=${page}`;
      if (sanitizedSearch) ep += '&search=' + encodeURIComponent(sanitizedSearch);
      const r = await stelFetch(ep);
      return respond(r.data, r.ok ? 200 : r.status);
    }

    if (action === 'get-budget') {
      const id = url.searchParams.get('id');
      if (!id) return respond({ error: 'id requerido' }, 400);
      const r = await stelFetch(`salesEstimates/${id}`);
      return respond(r.data, r.ok ? 200 : r.status);
    }

    if (action === 'create-budget') {
      if (!body) return respond({ error: 'Body requerido' }, 400);

      let clientId = body.client_id || body.clientId || body['client-id'];
      if (!clientId && body.client_name) {
        const sr = await stelFetch('clients?search=' + encodeURIComponent(body.client_name));
        if (sr.ok && Array.isArray(sr.data) && sr.data.length > 0) {
          clientId = sr.data[0].id;
        } else {
          const cr = await stelFetch('clients', 'POST', { name: body.client_name, email: body.client_email || '', commercialName: body.client_name });
          if (cr.ok) clientId = cr.data.id;
        }
      }

      // Map lines to STEL Order salesEstimates format (kebab-case fields)
      // deno-lint-ignore no-explicit-any
      const stelLines = (body.items || body.lines || []).map((i: any) => {
        const hasItemId = i['item-id'] || i.item_id || i.itemId;
        const lineType = hasItemId ? 'ITEM' : 'SECTION';
        // deno-lint-ignore no-explicit-any
        const line: any = {
          'line-type': i['line-type'] || lineType,
          name: i.name || i.nombre || i.concept || i.concepto || '',
          description: i.description || i.descripcion || '',
          'base-price': i['base-price'] || i.base_price || i.price || i.precio || 0,
          units: i.units || i.quantity || i.cantidad || i.uds || 1,
          'discount-percentage': i['discount-percentage'] || i.discount || i.descuento || 0,
        };
        if (hasItemId) line['item-id'] = hasItemId;
        if (i.reference || i.referencia) line.reference = i.reference || i.referencia;
        return line;
      });

      // deno-lint-ignore no-explicit-any
      const payload: any = {
        'account-id': clientId,
        lines: stelLines,
        title: body.title || body.subject || body.titulo || '',
        notes: body.notes || body.notas || '',
      };
      
      // Optional fields matching STEL Order form
      if (body.date || body.fecha) payload.date = body.date || body.fecha;
      if (body.agent_id || body['agent-id']) payload['agent-id'] = body.agent_id || body['agent-id'];
      if (body.payment_method || body['payment-method'] || body.forma_pago) {
        payload['payment-method'] = body.payment_method || body['payment-method'] || body.forma_pago;
      }
      if (body.valid_until || body.validUntil || body.validez) {
        payload['valid-until'] = body.valid_until || body.validUntil || body.validez;
      }
      if (body.tarifa || body.rate) payload.rate = body.tarifa || body.rate;

      console.log('[STEL] Creating salesEstimate with payload:', JSON.stringify(payload));
      const r = await stelFetch('salesEstimates', 'POST', payload);
      if (!r.ok) return respond({ error: 'Error al crear presupuesto', details: r.data }, r.status);
      return respond({ success: true, budget: r.data });
    }

    if (action === 'update-budget') {
      const id = url.searchParams.get('id');
      if (!id || !body) return respond({ error: 'id y body requeridos' }, 400);
      const r = await stelFetch(`salesEstimates/${id}`, 'PUT', body);
      if (!r.ok) return respond({ error: 'Error al actualizar', details: r.data }, r.status);
      return respond({ success: true, budget: r.data });
    }

    if (action === 'delete-budget') {
      const id = url.searchParams.get('id');
      if (!id) return respond({ error: 'id requerido' }, 400);
      const r = await stelFetch(`salesEstimates/${id}`, 'DELETE');
      return respond(r.ok ? { success: true } : { error: 'Error al eliminar', details: r.data }, r.ok ? 200 : r.status);
    }

    if (action === 'get-budget-pdf') {
      const id = url.searchParams.get('id');
      if (!id) return respond({ error: 'id requerido' }, 400);
      const r = await stelFetch(`salesEstimates/${id}/pdf`);
      return respond(r.data, r.ok ? 200 : r.status);
    }

    if (action === 'convert-to-invoice') {
      const id = url.searchParams.get('id');
      if (!id) return respond({ error: 'id requerido' }, 400);
      const br = await stelFetch(`salesEstimates/${id}`);
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
      const br = await stelFetch(`salesEstimates/${id}`);
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
      let ep = `clients?page=${page}&limit=50`;
      if (sanitizedSearch) ep += '&search=' + encodeURIComponent(sanitizedSearch);
      const r = await stelFetch(ep);
      return respond(r.data, r.ok ? 200 : r.status);
    }

    if (action === 'list-invoices') {
      const page = url.searchParams.get('page') || '1';
      const r = await stelFetch(`ordinaryInvoices?page=${page}&limit=50`);
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
