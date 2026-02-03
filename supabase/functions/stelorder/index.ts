import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * STEL Order API Integration
 * Documentation: https://api.stelorder.com/
 */
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
    const body = req.method === 'POST' ? await req.json() : null;

    // Base STEL Order API URL
    const STEL_API_BASE = 'https://api.stelorder.com/v2';

    // Common headers for STEL Order API
    const stelHeaders = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // CREATE INVOICE
    if (action === 'create-invoice') {
      const { 
        client_id, 
        client_name,
        client_email,
        items, 
        notes,
        payment_method,
        due_date 
      } = body;

      // First, check if client exists or create one
      let clientId = client_id;
      
      if (!clientId && client_name) {
        // Search for existing client
        const searchResponse = await fetch(`${STEL_API_BASE}/clients?search=${encodeURIComponent(client_name)}`, {
          method: 'GET',
          headers: stelHeaders
        });

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
              name: client_name,
              email: client_email || '',
              type: 'company'
            })
          });

          if (createClientResponse.ok) {
            const clientData = await createClientResponse.json();
            clientId = clientData.id;
          }
        }
      }

      // Create the invoice
      const invoicePayload = {
        client_id: clientId,
        items: items.map((item: any) => ({
          description: item.description || item.nombre,
          quantity: item.quantity || item.cantidad || 1,
          unit_price: item.unit_price || item.precio || 0,
          tax_rate: item.tax_rate || 21 // Default 21% IVA
        })),
        notes: notes || '',
        payment_method: payment_method || 'transfer',
        due_date: due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days
      };

      console.log('Creating STEL Order invoice:', invoicePayload);

      const invoiceResponse = await fetch(`${STEL_API_BASE}/invoices`, {
        method: 'POST',
        headers: stelHeaders,
        body: JSON.stringify(invoicePayload)
      });

      const invoiceData = await invoiceResponse.json();
      console.log('STEL Order response:', invoiceResponse.status, invoiceData);

      if (!invoiceResponse.ok) {
        return new Response(
          JSON.stringify({ 
            error: 'Error creating invoice in STEL Order', 
            details: invoiceData 
          }),
          { status: invoiceResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          invoice: invoiceData,
          message: 'Factura creada correctamente en STEL Order'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CREATE BUDGET/QUOTE
    if (action === 'create-budget') {
      const { 
        client_id, 
        client_name,
        client_email,
        items, 
        notes,
        valid_until 
      } = body;

      let clientId = client_id;
      
      // Search/create client same as invoice
      if (!clientId && client_name) {
        const searchResponse = await fetch(`${STEL_API_BASE}/clients?search=${encodeURIComponent(client_name)}`, {
          method: 'GET',
          headers: stelHeaders
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.data && searchData.data.length > 0) {
            clientId = searchData.data[0].id;
          }
        }

        if (!clientId) {
          const createClientResponse = await fetch(`${STEL_API_BASE}/clients`, {
            method: 'POST',
            headers: stelHeaders,
            body: JSON.stringify({
              name: client_name,
              email: client_email || '',
              type: 'company'
            })
          });

          if (createClientResponse.ok) {
            const clientData = await createClientResponse.json();
            clientId = clientData.id;
          }
        }
      }

      const budgetPayload = {
        client_id: clientId,
        items: items.map((item: any) => ({
          description: item.description || item.nombre,
          quantity: item.quantity || item.cantidad || 1,
          unit_price: item.unit_price || item.precio || 0,
          tax_rate: item.tax_rate || 21
        })),
        notes: notes || '',
        valid_until: valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };

      console.log('Creating STEL Order budget:', budgetPayload);

      const budgetResponse = await fetch(`${STEL_API_BASE}/budgets`, {
        method: 'POST',
        headers: stelHeaders,
        body: JSON.stringify(budgetPayload)
      });

      const budgetData = await budgetResponse.json();
      console.log('STEL Order budget response:', budgetResponse.status, budgetData);

      if (!budgetResponse.ok) {
        return new Response(
          JSON.stringify({ 
            error: 'Error creating budget in STEL Order', 
            details: budgetData 
          }),
          { status: budgetResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          budget: budgetData,
          message: 'Presupuesto creado correctamente en STEL Order'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // LIST CLIENTS
    if (action === 'list-clients') {
      const search = url.searchParams.get('search') || '';
      const page = url.searchParams.get('page') || '1';

      const clientsResponse = await fetch(
        `${STEL_API_BASE}/clients?search=${encodeURIComponent(search)}&page=${page}`,
        { method: 'GET', headers: stelHeaders }
      );

      const clientsData = await clientsResponse.json();

      return new Response(
        JSON.stringify(clientsData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // LIST INVOICES
    if (action === 'list-invoices') {
      const page = url.searchParams.get('page') || '1';

      const invoicesResponse = await fetch(
        `${STEL_API_BASE}/invoices?page=${page}`,
        { method: 'GET', headers: stelHeaders }
      );

      const invoicesData = await invoicesResponse.json();

      return new Response(
        JSON.stringify(invoicesData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Acción no válida. Acciones disponibles: create-invoice, create-budget, list-clients, list-invoices' }),
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
