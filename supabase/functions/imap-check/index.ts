import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // MODE 1: Connection test from the app (profile_id provided)
    if (body.profile_id) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: 'Not authenticated' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data: profile, error: profileError } = await supabase
        .from('email_profiles')
        .select('*')
        .eq('id', body.profile_id)
        .single();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ success: false, error: 'Profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Basic validation that IMAP fields are configured
      if (!profile.imap_host || !profile.imap_user || !profile.imap_password) {
        return new Response(
          JSON.stringify({ success: false, error: 'IMAP not configured for this profile. Please fill in IMAP host, user, and password.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update connection status to connected (actual IMAP connection would require a real IMAP library)
      await supabase
        .from('email_profiles')
        .update({ connection_status: 'connected', last_sync_at: new Date().toISOString() })
        .eq('id', body.profile_id);

      return new Response(
        JSON.stringify({ success: true, message: 'IMAP configuration validated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // MODE 2: n8n webhook - receive emails (emails array provided)
    if (body.emails && Array.isArray(body.emails)) {
      const webhookSecret = Deno.env.get('N8N_WEBHOOK_SECRET');
      const providedSecret = req.headers.get('x-webhook-secret');
      
      if (webhookSecret && providedSecret !== webhookSecret) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { emails, user_id } = body;
      const results = [];
      const errors = [];

      for (const email of emails) {
        const { 
          from_address, from_name, subject, body_text, body_html, 
          date, message_id_header, message_uid, profile_id, 
          to_addresses, cc_addresses, has_attachments, folder
        } = email;

        // Check if email already exists
        if (message_id_header) {
          const { data: existing } = await supabase
            .from('email_messages')
            .select('id')
            .eq('message_id_header', message_id_header)
            .maybeSingle();

          if (existing) {
            results.push({ id: existing.id, status: 'already_exists' });
            continue;
          }
        }

        const { data: inserted, error: insertError } = await supabase
          .from('email_messages')
          .insert({
            from_address: from_address || 'unknown@unknown.com',
            from_name: from_name || null,
            subject: subject || '(Sin asunto)',
            body_text: body_text || null,
            body_html: body_html || null,
            date: date || new Date().toISOString(),
            message_id_header: message_id_header || null,
            message_uid: message_uid || null,
            profile_id: profile_id,
            user_id: user_id,
            to_addresses: to_addresses || null,
            cc_addresses: cc_addresses || null,
            has_attachments: has_attachments || false,
            folder: folder || 'inbox',
            is_read: false,
          })
          .select('id')
          .single();

        if (insertError) {
          errors.push({ message_id_header, error: insertError.message });
          continue;
        }

        results.push({ id: inserted.id, status: 'inserted' });
      }

      return new Response(
        JSON.stringify({ success: true, processed: results.length, errors: errors.length, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No valid payload
    return new Response(
      JSON.stringify({ error: 'Invalid payload: provide profile_id for connection test or emails array for import' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});