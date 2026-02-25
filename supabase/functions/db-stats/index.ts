import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Verify user is admin
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get table sizes using pg_total_relation_size
    const { data: tableStats, error: statsError } = await supabase.rpc('get_table_stats');
    
    // Fallback: count rows for each known table
    const tables = [
      'leads', 'lead_activities', 'follow_up_reminders', 'email_messages',
      'email_campaigns', 'campaign_emails', 'waha_messages', 'whatsapp_chats',
      'internal_messages', 'internal_conversations', 'profiles', 'audit_logs',
      'general_reminders', 'calendar_events', 'osticket_tickets', 'ticket_notes',
      'seo_articles', 'shared_files', 'shared_folders', 'providers',
      'budget_requests', 'budgets_received', 'user_login_logs', 'user_interaction_logs',
    ];

    const tableCounts: Record<string, number> = {};
    for (const table of tables) {
      try {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        tableCounts[table] = count || 0;
      } catch {
        tableCounts[table] = 0;
      }
    }

    // Get storage bucket stats
    const buckets = ['avatars', 'chat-avatars', 'shared-files', 'chat-files', 'seo-images', 'email-attachments', 'ticket-files'];
    const storageCounts: Record<string, number> = {};
    for (const bucket of buckets) {
      try {
        const { data: files } = await supabase.storage.from(bucket).list('', { limit: 1000 });
        storageCounts[bucket] = files?.length || 0;
      } catch {
        storageCounts[bucket] = 0;
      }
    }

    // Total records
    const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0);

    return new Response(JSON.stringify({
      tableCounts,
      storageCounts,
      totalRecords,
      totalTables: tables.length,
      totalBuckets: buckets.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
