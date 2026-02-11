import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  profileId?: string; // Use a specific email profile
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, text, replyTo, profileId }: EmailRequest = await req.json();

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, and html or text" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let smtpHost: string | undefined;
    let smtpPort: number;
    let smtpUser: string | undefined;
    let smtpPassword: string | undefined;
    let fromEmail: string | undefined;
    let fromName: string = "Sistema";
    let smtpSecure = false;

    // If profileId is provided, load SMTP config from DB
    if (profileId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: profile, error: profileError } = await supabase
        .from("email_profiles")
        .select("*")
        .eq("id", profileId)
        .single();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: "Perfil de correo no encontrado" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      smtpHost = profile.smtp_host;
      smtpPort = profile.smtp_port || 587;
      smtpUser = profile.smtp_user;
      smtpPassword = profile.smtp_password;
      fromEmail = profile.from_email;
      fromName = profile.from_name || profile.profile_name || "Sistema";
      smtpSecure = profile.smtp_secure === "ssl";
    } else {
      // Fallback to env secrets
      smtpHost = Deno.env.get("SMTP_HOST");
      smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
      smtpUser = Deno.env.get("SMTP_USER");
      smtpPassword = Deno.env.get("SMTP_PASSWORD");
      fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
      fromName = Deno.env.get("SMTP_FROM_NAME") || "Sistema";
    }

    if (!smtpHost || !smtpUser || !smtpPassword || !fromEmail) {
      console.error("Missing SMTP configuration");
      return new Response(
        JSON.stringify({ error: "SMTP not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending via ${smtpHost}:${smtpPort} from ${fromEmail}`);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPassword },
      tls: { ciphers: "SSLv3", rejectUnauthorized: false },
    });

    const recipients = Array.isArray(to) ? to.join(", ") : to;

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipients,
      subject,
      text: text || undefined,
      html: html || undefined,
      replyTo: replyTo || undefined,
    });

    console.log("Email sent:", info.messageId);

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
