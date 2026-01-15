import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle both GET (from email link) and OPTIONS (CORS)
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const leadId = url.searchParams.get('lead');
    const token = url.searchParams.get('token');

    if (!leadId || !token) {
      return new Response(
        `<!DOCTYPE html>
        <html><body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Enlace inválido</h1>
          <p>El enlace de desuscripción no es válido.</p>
        </body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Decode and verify token (simple verification)
    try {
      const decoded = atob(token);
      if (!decoded.startsWith(leadId + ':')) {
        throw new Error('Invalid token');
      }
    } catch {
      return new Response(
        `<!DOCTYPE html>
        <html><body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Token inválido</h1>
          <p>El enlace de desuscripción ha expirado o no es válido.</p>
        </body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update lead to unsubscribed
    const { error } = await supabase
      .from('leads')
      .update({ email_unsubscribed: true })
      .eq('id', leadId);

    if (error) {
      console.error('Error unsubscribing:', error);
      throw error;
    }

    console.log(`Lead ${leadId} unsubscribed successfully`);

    // Return success page
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Desuscripción exitosa</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .card {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 400px;
          }
          h1 { color: #22c55e; margin-bottom: 16px; }
          p { color: #666; line-height: 1.6; }
          .icon { font-size: 64px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✅</div>
          <h1>Desuscripción exitosa</h1>
          <p>Has sido eliminado de nuestra lista de correo.</p>
          <p>Ya no recibirás más emails de campañas.</p>
          <p style="margin-top: 30px; font-size: 14px; color: #999;">
            Puedes cerrar esta ventana.
          </p>
        </div>
      </body>
      </html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error: any) {
    console.error("Error in unsubscribe function:", error);
    return new Response(
      `<!DOCTYPE html>
      <html><body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>❌ Error</h1>
        <p>Hubo un error al procesar tu solicitud. Por favor intenta de nuevo.</p>
      </body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
});
