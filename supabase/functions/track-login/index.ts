import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALERT_RECIPIENTS = [
  "administracion@malagamicro.com",
  "bonaquegar@gmail.com",
];

const KNOWN_IP_LOOKBACK_DAYS = 90;
const MAX_LOGINS_PER_HOUR = 10;
const MAX_DISTINCT_IPS_PER_HOUR = 5;
const BLOCK_DURATION_HOURS = 2;

async function sendSecurityAlert(subject: string, htmlBody: string) {
  try {
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") || "info@malagamicro.com";

    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.error("SMTP not configured, cannot send security alert");
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPassword },
      tls: { ciphers: "SSLv3", rejectUnauthorized: false },
    });

    await transporter.sendMail({
      from: `"🔒 Seguridad CRM" <${fromEmail}>`,
      to: ALERT_RECIPIENTS.join(", "),
      subject,
      html: htmlBody,
    });

    console.log("Security alert email sent:", subject);
  } catch (e) {
    console.error("Failed to send security alert:", e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_agent, device_type } = await req.json();

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';

    // Check if user already has an active block
    const { data: existingBlock } = await supabase
      .from('login_security_blocks')
      .select('id, reason, expires_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (existingBlock) {
      return new Response(JSON.stringify({
        success: false,
        blocked: true,
        reason: existingBlock.reason,
        expires_at: existingBlock.expires_at,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Geolocation
    let geo = { city: null as string | null, country: null as string | null, region: null as string | null, lat: null as number | null, lon: null as number | null };
    try {
      if (ip && ip !== 'unknown' && ip !== '127.0.0.1') {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,regionName,lat,lon`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          geo = {
            city: geoData.city || null,
            country: geoData.country || null,
            region: geoData.regionName || null,
            lat: geoData.lat || null,
            lon: geoData.lon || null,
          };
        }
      }
    } catch (e) {
      console.error('Geo lookup failed:', e);
    }

    // Insert the login log
    const { error: insertError } = await supabase.from('user_login_logs').insert({
      user_id: user.id,
      ip_address: ip,
      city: geo.city,
      country: geo.country,
      region: geo.region,
      latitude: geo.lat,
      longitude: geo.lon,
      user_agent: user_agent || null,
      device_type: device_type || 'desktop',
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== SECURITY CHECKS =====
    const alerts: string[] = [];
    const blockReasons: string[] = [];
    const userEmail = user.email || 'desconocido';
    const now = new Date();
    const locationStr = [geo.city, geo.region, geo.country].filter(Boolean).join(', ') || 'Ubicación desconocida';

    // 1. CHECK: Unknown IP
    const lookbackDate = new Date(now.getTime() - KNOWN_IP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: knownIPs } = await supabase
      .from('user_login_logs')
      .select('ip_address')
      .eq('user_id', user.id)
      .gte('created_at', lookbackDate)
      .neq('ip_address', ip);

    const uniqueKnownIPs = new Set((knownIPs || []).map(r => r.ip_address));

    let isNewIP = false;
    if (uniqueKnownIPs.size > 0 && ip !== 'unknown') {
      const { count } = await supabase
        .from('user_login_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('ip_address', ip)
        .lt('created_at', now.toISOString());

      if ((count || 0) <= 1) {
        isNewIP = true;
        alerts.push(`
          <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px;margin:8px 0;border-radius:4px;">
            <strong>⚠️ IP Desconocida Detectada</strong><br/>
            <b>IP:</b> ${ip}<br/>
            <b>Ubicación:</b> ${locationStr}<br/>
            <b>IPs conocidas anteriores:</b> ${uniqueKnownIPs.size}
          </div>
        `);
      }
    }

    // 2. CHECK: Too many logins in the last hour
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { count: recentLogins } = await supabase
      .from('user_login_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    if ((recentLogins || 0) > MAX_LOGINS_PER_HOUR) {
      alerts.push(`
        <div style="background:#f8d7da;border-left:4px solid #dc3545;padding:12px;margin:8px 0;border-radius:4px;">
          <strong>🚨 Actividad Sospechosa: Múltiples Logins</strong><br/>
          <b>${recentLogins} inicios de sesión</b> en la última hora.<br/>
          Posible ataque de fuerza bruta.
        </div>
      `);
      blockReasons.push('Demasiados inicios de sesión en poco tiempo');
    }

    // 3. CHECK: Too many distinct IPs
    const { data: recentIPsData } = await supabase
      .from('user_login_logs')
      .select('ip_address')
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    const distinctRecentIPs = new Set((recentIPsData || []).map(r => r.ip_address));
    if (distinctRecentIPs.size > MAX_DISTINCT_IPS_PER_HOUR) {
      alerts.push(`
        <div style="background:#f8d7da;border-left:4px solid #dc3545;padding:12px;margin:8px 0;border-radius:4px;">
          <strong>🚨 Múltiples IPs Diferentes</strong><br/>
          <b>${distinctRecentIPs.size} IPs distintas</b> en la última hora.<br/>
          Posible compromiso de credenciales.
        </div>
      `);
      blockReasons.push('Acceso desde demasiadas IPs distintas');
    }

    // 4. CHECK: Different country
    const { data: countryData } = await supabase
      .from('user_login_logs')
      .select('country')
      .eq('user_id', user.id)
      .not('country', 'is', null)
      .gte('created_at', lookbackDate)
      .limit(50);

    if (countryData && countryData.length > 3 && geo.country) {
      const countryCounts: Record<string, number> = {};
      for (const r of countryData) {
        if (r.country) countryCounts[r.country] = (countryCounts[r.country] || 0) + 1;
      }
      const totalEntries = countryData.length;
      const currentCountryCount = countryCounts[geo.country] || 0;
      const currentCountryPct = currentCountryCount / totalEntries;

      if (currentCountryPct < 0.05 && totalEntries > 5) {
        const usualCountry = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
        alerts.push(`
          <div style="background:#fff3cd;border-left:4px solid #ff8c00;padding:12px;margin:8px 0;border-radius:4px;">
            <strong>🌍 País Inusual Detectado</strong><br/>
            <b>País actual:</b> ${geo.country}<br/>
            <b>País habitual:</b> ${usualCountry}
          </div>
        `);
        blockReasons.push(`Acceso desde país inusual: ${geo.country}`);
      }
    }

    // 5. CHECK: New IP + unusual country = immediate block
    if (isNewIP && blockReasons.length > 0) {
      blockReasons.push('IP desconocida combinada con comportamiento sospechoso');
    }

    // Create block if critical alerts detected
    let blocked = false;
    let blockReason = '';
    if (blockReasons.length > 0) {
      // Check if user was recently unblocked (grace period of 1 hour)
      // This prevents re-blocking immediately after an admin unblock
      const oneHourAgoISO = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const { data: recentUnblock } = await supabase
        .from('login_security_blocks')
        .select('id, resolved_at')
        .eq('user_id', user.id)
        .eq('is_active', false)
        .not('resolved_at', 'is', null)
        .gte('resolved_at', oneHourAgoISO)
        .limit(1)
        .maybeSingle();

      if (!recentUnblock) {
        blockReason = blockReasons.join('; ');
        const expiresAt = new Date(now.getTime() + BLOCK_DURATION_HOURS * 60 * 60 * 1000).toISOString();
        
        await supabase.from('login_security_blocks').insert({
          user_id: user.id,
          ip_address: ip,
          reason: blockReason,
          alert_details: { alerts: alerts.length, ip, geo, device_type, user_agent },
          expires_at: expiresAt,
        });
        blocked = true;
      } else {
        console.log(`Skipping re-block for user ${user.id}: recently unblocked at ${recentUnblock.resolved_at}`);
      }
    }

    // Send alert email if any checks triggered
    if (alerts.length > 0) {
      const blockNote = blocked
        ? `<div style="background:#f8d7da;border:2px solid #dc3545;padding:12px;margin:12px 0;border-radius:4px;">
            <strong>🔐 ACCESO BLOQUEADO AUTOMÁTICAMENTE</strong><br/>
            El usuario ha sido bloqueado por ${BLOCK_DURATION_HOURS} horas.<br/>
            <b>Razón:</b> ${blockReason}<br/>
            Para desbloquear, ve al panel de administración.
          </div>`
        : '';

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1a1a2e;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
            <h2 style="margin:0;">🔒 Alerta de Seguridad - CRM</h2>
            <p style="margin:4px 0 0;opacity:0.8;font-size:14px;">${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
          </div>
          <div style="background:#f8f9fa;padding:20px;border-radius:0 0 8px 8px;">
            <p><b>Usuario:</b> ${userEmail}</p>
            <p><b>IP:</b> ${ip}</p>
            <p><b>Ubicación:</b> ${locationStr}</p>
            <p><b>Dispositivo:</b> ${device_type || 'desktop'}</p>
            <p><b>User Agent:</b> <code style="font-size:11px;word-break:break-all;">${(user_agent || 'N/A').substring(0, 150)}</code></p>
            
            ${blockNote}
            
            <h3 style="color:#dc3545;border-bottom:2px solid #dc3545;padding-bottom:8px;">Alertas Detectadas (${alerts.length})</h3>
            ${alerts.join('')}
            
            <div style="margin-top:20px;padding:12px;background:#e8f4fd;border-radius:4px;font-size:13px;">
              <strong>💡 Recomendación:</strong> Si no reconoces esta actividad, cambia la contraseña inmediatamente y revisa los accesos en el panel de Rendimiento.
            </div>
          </div>
        </div>
      `;

      // Don't await - fire and forget
      sendSecurityAlert(
        `🔒 ${blocked ? 'BLOQUEO' : 'Alerta'} de Seguridad: ${alerts.length} incidencia(s) - ${userEmail}`,
        html
      ).catch(e => console.error("Alert email error:", e));
    }

    return new Response(JSON.stringify({
      success: !blocked,
      blocked,
      reason: blocked ? blockReason : undefined,
      ip,
      geo,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
