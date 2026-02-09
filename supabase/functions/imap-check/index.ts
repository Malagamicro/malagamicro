import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Esta función es llamada por n8n mediante CRON cada 5 minutos
// n8n hace el polling IMAP y llama a este endpoint con los emails encontrados

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get('N8N_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('x-webhook-secret');
    
    if (webhookSecret && providedSecret !== webhookSecret) {
      throw new Error('Unauthorized');
    }

    const { emails, user_id } = await req.json();

    if (!emails || !Array.isArray(emails)) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload: emails array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const results = [];
    const errors = [];

    for (const email of emails) {
      const { 
        from_email, 
        from_name, 
        to_email,
        subject, 
        body_text, 
        body_html, 
        received_at, 
        message_id, 
        in_reply_to,
        attachments,
        request_id,
        provider_id
      } = email;

      // Verificar si el email ya existe
      const { data: existingEmail } = await supabase
        .from('emails_received')
        .select('id')
        .eq('message_id', message_id)
        .single();

      if (existingEmail) {
        results.push({ 
          email_id: existingEmail.id, 
          message_id, 
          status: 'already_exists' 
        });
        continue;
      }

      // Insertar email en BD
      const { data: insertedEmail, error: insertError } = await supabase
        .from('emails_received')
        .insert({
          from_email: from_email,
          from_name: from_name || null,
          to_email: to_email || Deno.env.get('IMAP_USER'),
          subject: subject || '(Sin asunto)',
          body_text: body_text || null,
          body_html: body_html || null,
          received_at: received_at || new Date().toISOString(),
          message_id: message_id,
          in_reply_to: in_reply_to || null,
          attachments: attachments || [],
          is_processed: false,
          request_id: request_id || null,
          provider_id: provider_id || null,
          user_id: user_id || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting email:', insertError);
        errors.push({ message_id, error: insertError.message });
        continue;
      }

      // Si hay request_id, intentar vincular con el presupuesto
      if (request_id) {
        // Buscar proveedor por email
        const { data: provider } = await supabase
          .from('providers')
          .select('id, nombre')
          .eq('email', from_email)
          .single();

        if (provider) {
          // Actualizar el email con el provider_id
          await supabase
            .from('emails_received')
            .update({ provider_id: provider.id })
            .eq('id', insertedEmail.id);

          // Crear notificación
          const { data: budgetRequest } = await supabase
            .from('budget_requests')
            .select('user_id')
            .eq('request_id', request_id)
            .single();

          if (budgetRequest?.user_id) {
            await supabase.from('budget_notifications').insert({
              user_id: budgetRequest.user_id,
              message: `Email recibido de ${provider.nombre}: ${subject}`,
              type: 'info',
              request_id: request_id,
              metadata: { 
                email_id: insertedEmail.id, 
                from_email,
                has_attachments: (attachments || []).length > 0 
              }
            });
          }
        }
      }

      results.push({ 
        email_id: insertedEmail.id, 
        message_id, 
        status: 'inserted' 
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length, 
        errors: errors.length,
        emails: results,
        error_details: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
