import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as hexEncode } from "https://deno.land/std@0.208.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate HMAC-SHA256 signature for verification
async function generateHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return new TextDecoder().decode(hexEncode(new Uint8Array(signature)));
}

// Constant-time string comparison to prevent timing attacks
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Verify HMAC-signed unsubscribe token
async function verifyUnsubscribeToken(
  token: string, 
  leadId: string, 
  secret: string
): Promise<{ valid: boolean; email?: string; error?: string }> {
  try {
    const decoded = atob(token);
    const parts = decoded.split(':');
    
    // Expected format: leadId:email:expiresAt:signature
    if (parts.length !== 4) {
      // Check for legacy format (leadId:email) for backwards compatibility
      if (parts.length === 2 && parts[0] === leadId) {
        return { valid: true, email: parts[1] };
      }
      return { valid: false, error: 'Invalid token format' };
    }
    
    const [tokenLeadId, email, expiresAtStr, signature] = parts;
    
    // Verify lead ID matches
    if (tokenLeadId !== leadId) {
      return { valid: false, error: 'Lead ID mismatch' };
    }
    
    // Check expiration
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      return { valid: false, error: 'Token expired' };
    }
    
    // Verify HMAC signature
    const payload = `${tokenLeadId}:${email}:${expiresAtStr}`;
    const expectedSignature = await generateHmacSignature(payload, secret);
    
    if (!secureCompare(signature, expectedSignature)) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    return { valid: true, email };
  } catch (error) {
    console.error('Token verification error:', error);
    return { valid: false, error: 'Token verification failed' };
  }
}

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

    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(leadId)) {
      return new Response(
        `<!DOCTYPE html>
        <html><body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Enlace inválido</h1>
          <p>El identificador del enlace no es válido.</p>
        </body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const unsubscribeSecret = Deno.env.get('UNSUBSCRIBE_SECRET') || supabaseKey;
    
    // Verify the secure token
    const verification = await verifyUnsubscribeToken(token, leadId, unsubscribeSecret);
    
    if (!verification.valid) {
      console.error(`Token verification failed for lead ${leadId}: ${verification.error}`);
      return new Response(
        `<!DOCTYPE html>
        <html><body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Token inválido</h1>
          <p>El enlace de desuscripción ha expirado o no es válido.</p>
          <p style="color: #999; font-size: 12px;">Por favor, solicita un nuevo email para desuscribirte.</p>
        </body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

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