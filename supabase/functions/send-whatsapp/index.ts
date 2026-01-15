import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppRequest {
  to: string;
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
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.error('Missing WhatsApp API credentials');
      throw new Error('WhatsApp API credentials not configured');
    }

    const { to, message, leadId, leadName } = await req.json() as WhatsAppRequest;

    if (!to || !message) {
      console.error('Missing required fields:', { to: !!to, message: !!message });
      throw new Error('Phone number (to) and message are required');
    }

    // Clean phone number - remove any non-digit characters
    const cleanPhone = to.replace(/\D/g, '');
    
    console.log(`Sending WhatsApp message to ${cleanPhone} for lead: ${leadName || 'unknown'}`);

    // Send message via WhatsApp Business API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        }),
      }
    );

    const responseData = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', responseData);
      throw new Error(responseData.error?.message || 'Failed to send WhatsApp message');
    }

    console.log('WhatsApp message sent successfully:', responseData);

    // Log activity if leadId is provided
    if (leadId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        type: 'whatsapp',
        description: `Mensaje de WhatsApp enviado: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
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
        messageId: responseData.messages?.[0]?.id 
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
