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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - please log in' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone, message, leadId, leadName } = await req.json() as WhatsAppRequest;

    if (!phone || !message) {
      throw new Error('Phone number and message are required');
    }

    const cleanPhone = phone.replace(/\D/g, '');
    
    console.log(`Sending WhatsApp message via Evolution API to ${cleanPhone} for lead: ${leadName || 'unknown'}`);

    // Evolution API configuration
    const evolutionApiUrl = Deno.env.get('WAHA_API_URL') || 'https://evolutionapi.malagamicro.com';
    const evolutionApiKey = Deno.env.get('WAHA_API_KEY') || '';
    const instanceName = 'CRM';
    
    const response = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Evolution API error:', responseData);
      throw new Error(responseData.message || 'Failed to send WhatsApp message');
    }

    console.log('WhatsApp message sent successfully via Evolution API:', responseData);

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

      const { data: leadData } = await supabase
        .from('leads')
        .select('whatsapp_sent_count')
        .eq('id', leadId)
        .single();

      const currentCount = leadData?.whatsapp_sent_count || 0;

      await supabase
        .from('leads')
        .update({ 
          last_contacted_at: new Date().toISOString(),
          whatsapp_sent_count: currentCount + 1
        })
        .eq('id', leadId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: responseData?.key?.id || 'sent'
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
