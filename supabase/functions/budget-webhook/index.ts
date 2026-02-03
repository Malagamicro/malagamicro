import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// This endpoint receives callbacks from n8n
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Optional: Verify webhook secret
    const webhookSecret = Deno.env.get('WAHA_WEBHOOK_SECRET');
    const providedSecret = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    
    // If secret is configured, verify it
    if (webhookSecret && providedSecret !== webhookSecret) {
      console.log('Webhook secret mismatch');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const body = await req.json();

    console.log('Budget webhook received:', action, body);

    // NOTIFICATION - n8n sends notification to user
    if (action === 'notification') {
      const { user_id, user_email, message, type, request_id, emails_preview, invoice_url } = body;

      // Find user by email if user_id not provided
      let targetUserId = user_id;
      if (!targetUserId && user_email) {
        const { data: users } = await serviceClient.auth.admin.listUsers();
        const targetUser = users?.users?.find(u => u.email === user_email);
        targetUserId = targetUser?.id;
      }

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert notification
      const { error: notifError } = await serviceClient
        .from('budget_notifications')
        .insert({
          user_id: targetUserId,
          message,
          type: type || 'info',
          request_id,
          metadata: emails_preview ? { emails_preview } : null,
          invoice_url
        });

      if (notifError) {
        console.error('Notification insert error:', notifError);
        return new Response(
          JSON.stringify({ error: 'Error saving notification' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Notification sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // APPROVAL_REQUEST - n8n requests approval from Inma via internal chat
    if (action === 'approval_request') {
      const { request_id, emails_preview, prompt, providers_count, user_email } = body;

      // Find Inma's user ID (admin user)
      const { data: users } = await serviceClient.auth.admin.listUsers();
      const inmaUser = users?.users?.find(u => 
        u.email?.toLowerCase().includes('inma') || 
        u.email === 'administracion@malagamicro.com'
      );

      if (!inmaUser) {
        console.error('Inma user not found');
        return new Response(
          JSON.stringify({ error: 'Approval user not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find requesting user
      const requestingUser = users?.users?.find(u => u.email === user_email);

      // Update request with preview
      await serviceClient
        .from('budget_requests')
        .update({ 
          emails_preview,
          status: 'pending_approval'
        })
        .eq('request_id', request_id);

      // Create/find conversation with Inma for approvals
      const systemUserId = requestingUser?.id || inmaUser.id;

      // Check for existing approval conversation
      let conversationId: string;
      const { data: existingConvs } = await serviceClient
        .from('internal_conversations')
        .select('id')
        .eq('name', 'Aprobaciones de Presupuestos')
        .limit(1);

      if (existingConvs && existingConvs.length > 0) {
        conversationId = existingConvs[0].id;
      } else {
        // Create new conversation for approvals
        const { data: newConv, error: convError } = await serviceClient
          .from('internal_conversations')
          .insert({
            name: 'Aprobaciones de Presupuestos',
            created_by: inmaUser.id,
            is_group: false
          })
          .select('id')
          .single();

        if (convError || !newConv) {
          console.error('Conversation create error:', convError);
          return new Response(
            JSON.stringify({ error: 'Error creating conversation' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        conversationId = newConv.id;

        // Add Inma as participant
        await serviceClient
          .from('conversation_participants')
          .insert({
            conversation_id: conversationId,
            user_id: inmaUser.id,
            is_admin: true
          });
      }

      // Create approval message with special format
      const approvalMessage = {
        type: 'budget_approval',
        request_id,
        prompt,
        providers_count,
        emails_preview,
        user_email,
        created_at: new Date().toISOString()
      };

      const { error: msgError } = await serviceClient
        .from('internal_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: inmaUser.id,
          content: JSON.stringify(approvalMessage),
          message_type: 'budget_approval'
        });

      if (msgError) {
        console.error('Message insert error:', msgError);
        return new Response(
          JSON.stringify({ error: 'Error sending approval message' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Also send notification
      await serviceClient
        .from('budget_notifications')
        .insert({
          user_id: inmaUser.id,
          message: `Nueva solicitud de presupuesto pendiente de aprobación (${request_id})`,
          type: 'warning',
          request_id,
          metadata: { emails_preview, prompt, providers_count }
        });

      return new Response(
        JSON.stringify({ success: true, message: 'Approval request sent to Inma' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // BUDGET_RECEIVED - n8n sends received budget from provider
    if (action === 'budget_received') {
      const { 
        request_id, proveedor, email_proveedor, productos, 
        total, observaciones, user_responsible_email 
      } = body;

      // Find responsible user
      const { data: users } = await serviceClient.auth.admin.listUsers();
      const responsibleUser = users?.users?.find(u => 
        u.email === user_responsible_email || 
        u.email?.toLowerCase().includes('inma') ||
        u.email === 'administracion@malagamicro.com'
      );

      if (!responsibleUser) {
        return new Response(
          JSON.stringify({ error: 'Responsible user not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: budgetError } = await serviceClient
        .from('budgets_received')
        .insert({
          request_id,
          proveedor,
          email_proveedor,
          productos: productos || [],
          total,
          observaciones,
          user_responsible: responsibleUser.id
        });

      if (budgetError) {
        console.error('Budget insert error:', budgetError);
        return new Response(
          JSON.stringify({ error: 'Error saving budget' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send notification
      await serviceClient
        .from('budget_notifications')
        .insert({
          user_id: responsibleUser.id,
          message: `Nuevo presupuesto recibido de ${proveedor}: ${total}€`,
          type: 'success',
          request_id
        });

      return new Response(
        JSON.stringify({ success: true, message: 'Budget received and saved' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // LOG - n8n sends workflow logs
    if (action === 'log') {
      const { level, message, error_details, request_id, node_error, metadata } = body;

      const { error: logError } = await serviceClient
        .from('workflow_logs')
        .insert({
          level: level || 'info',
          message,
          error_details,
          request_id,
          node_error,
          metadata
        });

      if (logError) {
        console.error('Log insert error:', logError);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Budget webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
