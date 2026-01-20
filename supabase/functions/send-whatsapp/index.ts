import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppRequest {
  phone: string;
  message: string;
  leadId?: string;
  leadName?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create client with user's auth token to verify authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - please log in' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    const { phone, message, leadId, leadName } = await req.json() as WhatsAppRequest;

    if (!phone || !message) {
      console.error('Missing required fields:', { phone: !!phone, message: !!message });
      throw new Error('Phone number and message are required');
    }

    // Clean phone number - remove any non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    
    console.log(`Sending WhatsApp message via WAHA to ${cleanPhone} for lead: ${leadName || 'unknown'}`);

    // Send message via WAHA local API
    // Using host.docker.internal for Docker-to-host networking
    const response = await fetch('http://host.docker.internal:3000/api/sendText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': '12345678',
      },
      body: JSON.stringify({
        chatId: `${cleanPhone}@c.us`,
        text: message,
        session: 'default',
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('WAHA API error:', responseData);
      throw new Error(responseData.message || 'Failed to send WhatsApp message');
    }

    console.log('WhatsApp message sent successfully via WAHA:', responseData);

    // Log activity if leadId is provided
    if (leadId) {
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        type: 'whatsapp',
        description: `Mensaje de WhatsApp enviado: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
        user_id: user.id,
      });

      // Update last_contacted_at
      await supabase
        .from('leads')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', leadId);

      console.log('Activity logged for lead:', leadId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: responseData.id || 'sent'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in send-whatsapp function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send WhatsApp message' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
