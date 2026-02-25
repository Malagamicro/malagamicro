import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, deviceInfo } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Mensaje requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (message.length > 1000) {
      return new Response(
        JSON.stringify({ error: "Mensaje demasiado largo (máx 1000 caracteres)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get SMTP config from Christian's info@malagamicro.com profile
    const profileId = "27e99fe7-235e-4fc2-b317-02dd23079e5f";
    const { data: profile, error: profileError } = await supabase
      .from("email_profiles")
      .select("*")
      .eq("id", profileId)
      .single();

    if (profileError || !profile) {
      console.error("Profile not found:", profileError);
      return new Response(
        JSON.stringify({ error: "Perfil de correo no encontrado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smtpSecure = profile.smtp_secure === "ssl";
    const transporter = nodemailer.createTransport({
      host: profile.smtp_host,
      port: profile.smtp_port || 587,
      secure: smtpSecure,
      auth: { user: profile.smtp_user, pass: profile.smtp_password },
      tls: { ciphers: "SSLv3", rejectUnauthorized: false },
    });

    const now = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 12px 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">⚠️ MENSAJE DESDE LA PANTALLA DE LOGIN</h2>
        </div>
        <div style="border: 1px solid #e5e7eb; padding: 20px; border-radius: 0 0 8px 8px;">
          <h3 style="color: #374151;">Mensaje del usuario:</h3>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; white-space: pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          </div>
          
          <h3 style="color: #374151;">Información del dispositivo:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Fecha/Hora</td><td style="padding: 6px; border-bottom: 1px solid #e5e7eb;">${now}</td></tr>
            <tr><td style="padding: 6px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Navegador</td><td style="padding: 6px; border-bottom: 1px solid #e5e7eb;">${deviceInfo?.browser || "Desconocido"}</td></tr>
            <tr><td style="padding: 6px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Sistema Operativo</td><td style="padding: 6px; border-bottom: 1px solid #e5e7eb;">${deviceInfo?.os || "Desconocido"}</td></tr>
            <tr><td style="padding: 6px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Dispositivo</td><td style="padding: 6px; border-bottom: 1px solid #e5e7eb;">${deviceInfo?.device || "Desconocido"}</td></tr>
            <tr><td style="padding: 6px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Resolución</td><td style="padding: 6px; border-bottom: 1px solid #e5e7eb;">${deviceInfo?.screen || "Desconocida"}</td></tr>
            <tr><td style="padding: 6px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">IP</td><td style="padding: 6px; border-bottom: 1px solid #e5e7eb;">${deviceInfo?.ip || "No disponible"}</td></tr>
            <tr><td style="padding: 6px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Ubicación aprox.</td><td style="padding: 6px; border-bottom: 1px solid #e5e7eb;">${deviceInfo?.location || "No disponible"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">User Agent</td><td style="padding: 6px;">${deviceInfo?.userAgent || "Desconocido"}</td></tr>
          </table>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Soporte Login CRM" <${profile.from_email}>`,
      to: "administracion@malagamicro.com",
      subject: `[LOGIN] Solicitud de soporte - ${now}`,
      html,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending support email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error al enviar" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
