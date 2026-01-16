import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReminderWithDetails {
  id: string;
  lead_id: string;
  user_id: string;
  reminder_date: string;
  message: string | null;
  leads: {
    company_name: string;
    contact_name: string | null;
  };
}

interface UserProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting reminder notification check...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get today's date range (start and end of day in UTC)
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    console.log(`Checking reminders between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

    // Fetch pending reminders that are due today or overdue
    const { data: reminders, error: remindersError } = await supabase
      .from('follow_up_reminders')
      .select(`
        id,
        lead_id,
        user_id,
        reminder_date,
        message,
        leads (
          company_name,
          contact_name
        )
      `)
      .eq('is_completed', false)
      .lte('reminder_date', endOfDay.toISOString())
      .order('reminder_date', { ascending: true });

    if (remindersError) {
      console.error('Error fetching reminders:', remindersError);
      throw remindersError;
    }

    console.log(`Found ${reminders?.length || 0} pending reminders`);

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending reminders found', sent: 0 }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Group reminders by user
    const remindersByUser = new Map<string, typeof reminders>();
    for (const reminder of reminders) {
      const userId = reminder.user_id;
      if (!remindersByUser.has(userId)) {
        remindersByUser.set(userId, []);
      }
      remindersByUser.get(userId)!.push(reminder);
    }

    console.log(`Grouped into ${remindersByUser.size} user(s)`);

    // Fetch user emails from auth.users using admin API and profiles for full_name
    const userIds = Array.from(remindersByUser.keys());
    
    // Get profiles for full names
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // Get user emails from auth.users
    const userEmails = new Map<string, UserProfile>();
    for (const userId of userIds) {
      try {
        const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
        if (!error && user?.email) {
          const profile = profileMap.get(userId);
          userEmails.set(userId, {
            user_id: userId,
            email: user.email,
            full_name: profile?.full_name || null,
          });
        }
      } catch (err) {
        console.error(`Error fetching user ${userId}:`, err);
      }
    }

    let emailsSent = 0;
    const errors: string[] = [];

    // Send email to each user with their reminders
    for (const [userId, userReminders] of remindersByUser) {
      const userProfile = userEmails.get(userId);
      
      if (!userProfile?.email) {
        console.log(`No email found for user ${userId}, skipping...`);
        continue;
      }

      // Build the email content
      const overdueReminders = userReminders.filter(r => new Date(r.reminder_date) < startOfDay);
      const todayReminders = userReminders.filter(r => {
        const date = new Date(r.reminder_date);
        return date >= startOfDay && date <= endOfDay;
      });

      const userName = userProfile.full_name || 'Usuario';
      
      let html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1a1a2e; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">
            📋 Recordatorios de Seguimiento
          </h1>
          <p style="color: #444;">Hola ${userName},</p>
          <p style="color: #444;">Tienes los siguientes recordatorios pendientes:</p>
      `;

      if (overdueReminders.length > 0) {
        html += `
          <h2 style="color: #dc2626; margin-top: 20px;">⚠️ Vencidos (${overdueReminders.length})</h2>
          <ul style="list-style: none; padding: 0;">
        `;
        for (const reminder of overdueReminders) {
          const lead = reminder.leads as any;
          const date = new Date(reminder.reminder_date);
          html += `
            <li style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin: 8px 0; border-radius: 4px;">
              <strong style="color: #1a1a2e;">${lead?.company_name || 'Lead'}</strong>
              <br/>
              <span style="color: #666; font-size: 14px;">
                📅 ${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} a las ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
              ${reminder.message ? `<br/><span style="color: #666; font-size: 14px;">💬 ${reminder.message}</span>` : ''}
            </li>
          `;
        }
        html += '</ul>';
      }

      if (todayReminders.length > 0) {
        html += `
          <h2 style="color: #f59e0b; margin-top: 20px;">🔔 Para Hoy (${todayReminders.length})</h2>
          <ul style="list-style: none; padding: 0;">
        `;
        for (const reminder of todayReminders) {
          const lead = reminder.leads as any;
          const date = new Date(reminder.reminder_date);
          html += `
            <li style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; margin: 8px 0; border-radius: 4px;">
              <strong style="color: #1a1a2e;">${lead?.company_name || 'Lead'}</strong>
              ${lead?.contact_name ? `<span style="color: #666;"> - ${lead.contact_name}</span>` : ''}
              <br/>
              <span style="color: #666; font-size: 14px;">
                ⏰ ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
              ${reminder.message ? `<br/><span style="color: #666; font-size: 14px;">💬 ${reminder.message}</span>` : ''}
            </li>
          `;
        }
        html += '</ul>';
      }

      html += `
          <p style="color: #666; margin-top: 30px; font-size: 14px;">
            Accede a tu CRM para gestionar estos recordatorios.
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            Este es un mensaje automático de MalagaMicro CRM.
          </p>
        </div>
      `;

      const totalReminders = overdueReminders.length + todayReminders.length;
      const subject = overdueReminders.length > 0 
        ? `⚠️ Tienes ${totalReminders} recordatorio(s) pendiente(s) - ${overdueReminders.length} vencido(s)`
        : `🔔 Tienes ${todayReminders.length} recordatorio(s) para hoy`;

      try {
        console.log(`Sending email to ${userProfile.email} with ${totalReminders} reminders`);
        
        const emailResponse = await resend.emails.send({
          from: "MalagaMicro CRM <onboarding@resend.dev>",
          to: [userProfile.email],
          subject: subject,
          html: html,
        });

        console.log(`Email sent successfully to ${userProfile.email}:`, emailResponse);
        emailsSent++;
      } catch (emailError: any) {
        console.error(`Failed to send email to ${userProfile.email}:`, emailError);
        errors.push(`Failed to send to ${userProfile.email}: ${emailError.message}`);
      }
    }

    const response = {
      message: `Reminder notifications processed`,
      totalReminders: reminders.length,
      usersNotified: emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log('Reminder notification job completed:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-reminder-notifications function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
