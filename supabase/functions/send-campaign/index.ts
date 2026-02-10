import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as hexEncode } from "https://deno.land/std@0.208.0/encoding/hex.ts";
import nodemailer from "npm:nodemailer@6.9.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeHtmlContent(html: string): string {
  if (!html) return '';
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'src=""');
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*data:[^"'>]*/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']?\s*data:[^"'>]*/gi, 'src=""');
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, '');
  sanitized = sanitized.replace(/behavior\s*:/gi, '');
  return sanitized;
}

async function generateHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return new TextDecoder().decode(hexEncode(new Uint8Array(signature)));
}

async function generateUnsubscribeToken(leadId: string, email: string, secret: string): Promise<string> {
  const expiresAt = Date.now() + (90 * 24 * 60 * 60 * 1000);
  const payload = `${leadId}:${email}:${expiresAt}`;
  const signature = await generateHmacSignature(payload, secret);
  return btoa(`${payload}:${signature}`);
}

const MAX_EMAILS_PER_BATCH = 10;
const DELAY_BETWEEN_EMAILS_MS = 6000;
const MAX_DAILY_EMAILS = 50;

function personalizeEmail(template: string, lead: any): string {
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
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
    const { campaignId } = await req.json();

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
        JSON.stringify({ error: `Límite diario alcanzado (${MAX_DAILY_EMAILS} emails). Intenta mañana.`, limitReached: true }),
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

    if (campaignError || !campaign) throw new Error('Campaign not found');
    if (!campaign.email_templates) throw new Error('No template associated with campaign');

    // Get email profile for sending
    let emailProfile: any = null;
    if (campaign.profile_id) {
      const { data: profile } = await supabase
        .from('email_profiles')
        .select('*')
        .eq('id', campaign.profile_id)
        .single();
      emailProfile = profile;
    }

    if (!emailProfile) {
      // Fallback: try to get default profile
      const { data: defaultProfile } = await supabase
        .from('email_profiles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();
      emailProfile = defaultProfile;
    }

    if (!emailProfile) {
      // Last fallback: get any profile
      const { data: anyProfile } = await supabase
        .from('email_profiles')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      emailProfile = anyProfile;
    }

    if (!emailProfile) {
      throw new Error('No hay perfiles de correo configurados. Configura uno en Ajustes > Perfiles de correo.');
    }

    console.log(`Using email profile: ${emailProfile.profile_name} (${emailProfile.from_email})`);

    // Create nodemailer transporter with the user's SMTP profile
    const transporter = nodemailer.createTransport({
      host: emailProfile.smtp_host,
      port: emailProfile.smtp_port || 587,
      secure: emailProfile.smtp_secure === 'ssl',
      auth: {
        user: emailProfile.smtp_user,
        pass: emailProfile.smtp_password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Get pending emails
    const batchSize = Math.min(MAX_EMAILS_PER_BATCH, remainingToday);
    const { data: pendingEmails, error: pendingError } = await supabase
      .from('campaign_emails')
      .select('*, leads(*)')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .limit(batchSize);

    if (pendingError) throw pendingError;

    if (!pendingEmails || pendingEmails.length === 0) {
      await supabase
        .from('email_campaigns')
        .update({ status: 'completed', sent_at: new Date().toISOString() })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({ message: 'No pending emails', completed: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase
      .from('email_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId);

    const template = campaign.email_templates;
    const results = { sent: 0, failed: 0, errors: [] as string[] };
    const unsubscribeBaseUrl = `${supabaseUrl}/functions/v1/unsubscribe`;
    const fromName = emailProfile.from_name || emailProfile.profile_name || 'CRM';
    const fromEmail = emailProfile.from_email;

    for (const emailRecord of pendingEmails) {
      const lead = emailRecord.leads;
      
      if (!lead || !lead.email || lead.email_unsubscribed) {
        await supabase
          .from('campaign_emails')
          .update({ status: 'failed', error_message: lead?.email_unsubscribed ? 'Lead unsubscribed' : 'No valid email' })
          .eq('id', emailRecord.id);
        results.failed++;
        continue;
      }

      try {
        const personalizedSubject = personalizeEmail(template.subject, lead);
        const personalizedBody = personalizeEmail(template.body, lead);
        const sanitizedBody = sanitizeHtmlContent(personalizedBody);
        
        const secureToken = await generateUnsubscribeToken(lead.id, lead.email, unsubscribeSecret);
        const unsubscribeUrl = `${unsubscribeBaseUrl}?lead=${lead.id}&token=${encodeURIComponent(secureToken)}`;
        
        const htmlWithUnsubscribe = `
          ${sanitizedBody}
          <br/><br/>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
          <p style="font-size: 12px; color: #666; text-align: center;">
            Si no deseas recibir más emails, 
            <a href="${unsubscribeUrl}" style="color: #666;">haz clic aquí para desuscribirte</a>
          </p>
        `;

        console.log(`Sending email to ${lead.email} via ${fromEmail}`);

        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: lead.email,
          subject: personalizedSubject,
          html: htmlWithUnsubscribe,
        });

        await supabase
          .from('campaign_emails')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', emailRecord.id);

        results.sent++;
        console.log(`Email sent successfully to ${lead.email}`);

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
          ? `Enviados ${results.sent} emails. Quedan ${totalPending} pendientes.`
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
