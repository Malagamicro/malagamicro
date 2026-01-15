import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "https://esm.sh/resend@2.0.0";
import { encode as hexEncode } from "https://deno.land/std@0.208.0/encoding/hex.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HTML sanitization to prevent XSS attacks
function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Sanitize HTML content - escape dangerous patterns while preserving safe HTML
function sanitizeHtmlContent(html: string): string {
  if (!html) return '';
  
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');
  
  // Remove javascript: and data: URLs from href and src attributes
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'src=""');
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*data:[^"'>]*/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']?\s*data:[^"'>]*/gi, 'src=""');
  
  // Remove style expressions and behavior
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, '');
  sanitized = sanitized.replace(/behavior\s*:/gi, '');
  
  return sanitized;
}

// Generate HMAC-SHA256 signature
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

// Generate secure unsubscribe token with HMAC signature and expiration
async function generateUnsubscribeToken(leadId: string, email: string, secret: string): Promise<string> {
  // Token expires in 90 days
  const expiresAt = Date.now() + (90 * 24 * 60 * 60 * 1000);
  const payload = `${leadId}:${email}:${expiresAt}`;
  const signature = await generateHmacSignature(payload, secret);
  return btoa(`${payload}:${signature}`);
}

// Anti-spam settings
const MAX_EMAILS_PER_BATCH = 10;
const DELAY_BETWEEN_EMAILS_MS = 6000; // 6 seconds between emails (10 per minute max)
const MAX_DAILY_EMAILS = 50;

interface CampaignRequest {
  campaignId: string;
}

// Helper to replace template variables with sanitized values
function personalizeEmail(template: string, lead: any): string {
  // Escape lead data to prevent XSS when inserting into HTML
  const safeName = escapeHtml(lead.contact_name || 'Estimado/a');
  const safeCompany = escapeHtml(lead.company_name || '');
  const safeCity = escapeHtml(lead.city || '');
  const safeEmail = escapeHtml(lead.email || '');
  
  return template
    .replace(/\{\{nombre\}\}/gi, safeName)
    .replace(/\{\{empresa\}\}/gi, safeCompany)
    .replace(/\{\{ciudad\}\}/gi, safeCity)
    .replace(/\{\{email\}\}/gi, safeEmail);
}

// Sleep helper for rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const unsubscribeSecret = Deno.env.get('UNSUBSCRIBE_SECRET') || supabaseServiceKey;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { campaignId }: CampaignRequest = await req.json();

    console.log(`Starting campaign ${campaignId} for user ${user.id}`);

    // Check daily sending limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: sentToday } = await supabase
      .from('campaign_emails')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', today.toISOString())
      .eq('status', 'sent');

    if ((sentToday || 0) >= MAX_DAILY_EMAILS) {
      return new Response(
        JSON.stringify({ 
          error: `Límite diario alcanzado (${MAX_DAILY_EMAILS} emails). Intenta mañana.`,
          limitReached: true 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const remainingToday = MAX_DAILY_EMAILS - (sentToday || 0);

    // Get campaign with template
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*, email_templates(*)')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    if (!campaign.email_templates) {
      throw new Error('No template associated with campaign');
    }

    // Get pending emails for this campaign (limit to batch size and daily remaining)
    const batchSize = Math.min(MAX_EMAILS_PER_BATCH, remainingToday);
    
    const { data: pendingEmails, error: pendingError } = await supabase
      .from('campaign_emails')
      .select('*, leads(*)')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .limit(batchSize);

    if (pendingError) {
      throw pendingError;
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      // Update campaign status if all done
      await supabase
        .from('email_campaigns')
        .update({ status: 'completed', sent_at: new Date().toISOString() })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({ message: 'No pending emails', completed: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update campaign status to sending
    await supabase
      .from('email_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId);

    const template = campaign.email_templates;
    const results = { sent: 0, failed: 0, errors: [] as string[] };
    const unsubscribeBaseUrl = `${supabaseUrl}/functions/v1/unsubscribe`;

    // Send emails with rate limiting
    for (const emailRecord of pendingEmails) {
      const lead = emailRecord.leads;
      
      if (!lead || !lead.email || lead.email_unsubscribed) {
        await supabase
          .from('campaign_emails')
          .update({ 
            status: 'failed', 
            error_message: lead?.email_unsubscribed ? 'Lead unsubscribed' : 'No valid email' 
          })
          .eq('id', emailRecord.id);
        results.failed++;
        continue;
      }

      try {
        // Personalize email content (personalizeEmail already escapes lead data)
        const personalizedSubject = personalizeEmail(template.subject, lead);
        const personalizedBody = personalizeEmail(template.body, lead);
        
        // Sanitize the template body to remove any malicious HTML
        const sanitizedBody = sanitizeHtmlContent(personalizedBody);
        
        // Generate secure unsubscribe token with HMAC signature
        const secureToken = await generateUnsubscribeToken(lead.id, lead.email, unsubscribeSecret);
        const unsubscribeUrl = `${unsubscribeBaseUrl}?lead=${lead.id}&token=${encodeURIComponent(secureToken)}`;
        
        // Add unsubscribe footer
        const htmlWithUnsubscribe = `
          ${sanitizedBody}
          <br/><br/>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
          <p style="font-size: 12px; color: #666; text-align: center;">
            Si no deseas recibir más emails, 
            <a href="${unsubscribeUrl}" style="color: #666;">
              haz clic aquí para desuscribirte
            </a>
          </p>
        `;

        console.log(`Sending email to ${lead.email}`);

        await resend.emails.send({
          from: "MalagaMicro CRM <onboarding@resend.dev>",
          to: [lead.email],
          subject: personalizedSubject,
          html: htmlWithUnsubscribe,
        });

        // Update email record as sent
        await supabase
          .from('campaign_emails')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', emailRecord.id);

        results.sent++;
        console.log(`Email sent successfully to ${lead.email}`);

        // Rate limiting delay between emails
        if (pendingEmails.indexOf(emailRecord) < pendingEmails.length - 1) {
          await sleep(DELAY_BETWEEN_EMAILS_MS);
        }

      } catch (error: any) {
        console.error(`Failed to send to ${lead.email}:`, error);
        
        await supabase
          .from('campaign_emails')
          .update({ status: 'failed', error_message: error.message })
          .eq('id', emailRecord.id);

        results.failed++;
        results.errors.push(`${lead.email}: ${error.message}`);
      }
    }

    // Update campaign totals
    const { count: totalSent } = await supabase
      .from('campaign_emails')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'sent');

    const { count: totalPending } = await supabase
      .from('campaign_emails')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    await supabase
      .from('email_campaigns')
      .update({ 
        total_sent: totalSent || 0,
        status: (totalPending || 0) === 0 ? 'completed' : 'paused'
      })
      .eq('id', campaignId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...results,
        remaining: totalPending,
        message: (totalPending || 0) > 0 
          ? `Enviados ${results.sent} emails. Quedan ${totalPending} pendientes. Continúa enviando para completar.`
          : 'Campaña completada'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error in send-campaign function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});