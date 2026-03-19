import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the database role system instead of hardcoded email
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { data: roleData } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin role required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = serviceClient;

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // LIST USERS
    if (req.method === 'GET' && action === 'list') {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 100
      });

      if (error) {
        throw error;
      }

      const { data: roles } = await adminClient
        .from('user_roles')
        .select('user_id, role');

      const { data: profiles } = await adminClient
        .from('profiles')
        .select('user_id, full_name');

      const rolesMap = new Map();
      roles?.forEach(r => {
        if (!rolesMap.has(r.user_id)) {
          rolesMap.set(r.user_id, []);
        }
        rolesMap.get(r.user_id).push(r.role);
      });

      const profilesMap = new Map();
      profiles?.forEach(p => {
        profilesMap.set(p.user_id, p.full_name);
      });

      const usersWithRoles = users.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        email_confirmed_at: u.email_confirmed_at,
        last_sign_in_at: u.last_sign_in_at,
        roles: rolesMap.get(u.id) || [],
        full_name: profilesMap.get(u.id) || null
      }));

      return new Response(
        JSON.stringify({ users: usersWithRoles }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CREATE USER
    if (req.method === 'POST' && action === 'create') {
      const { email, password, role } = await req.json();

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: 'Email and password are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (createError) {
        if (createError.code === 'email_exists' || createError.message?.includes('already been registered')) {
          return new Response(
            JSON.stringify({ error: 'Este email ya está registrado en el sistema' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ error: createError.message || 'Error al crear usuario' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (role && newUser.user) {
        await adminClient.from('user_roles').insert({
          user_id: newUser.user.id,
          role: role
        });
      }

      await adminClient.from('profiles').insert({
        user_id: newUser.user!.id,
        full_name: email.split('@')[0]
      });

      return new Response(
        JSON.stringify({ user: newUser.user, message: 'User created successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE USER
    if (req.method === 'POST' && action === 'delete') {
      const { userId } = await req.json();

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Prevent deleting yourself
      if (userId === user.id) {
        return new Response(
          JSON.stringify({ error: 'Cannot delete your own account' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

      if (deleteError) {
        throw deleteError;
      }

      return new Response(
        JSON.stringify({ message: 'User deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UPDATE PASSWORD
    if (req.method === 'POST' && action === 'update-password') {
      const { userId, password } = await req.json();

      if (!userId || !password) {
        return new Response(
          JSON.stringify({ error: 'User ID and password are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
        password: password
      });

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({ message: 'Password updated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SET ROLE
    if (req.method === 'POST' && action === 'set-role') {
      const { userId, role } = await req.json();

      if (!userId || !role) {
        return new Response(
          JSON.stringify({ error: 'User ID and role are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await adminClient.from('user_roles').delete().eq('user_id', userId);

      const { error: roleError } = await adminClient.from('user_roles').insert({
        user_id: userId,
        role: role
      });

      if (roleError) {
        throw roleError;
      }

      return new Response(
        JSON.stringify({ message: 'Role updated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // LIST SECURITY BLOCKS
    if (req.method === 'GET' && action === 'list-blocks') {
      const { data: blocks, error: blocksError } = await adminClient
        .from('login_security_blocks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (blocksError) throw blocksError;

      // Enrich with user emails
      const userIds = [...new Set((blocks || []).map(b => b.user_id))];
      const enriched = await Promise.all((blocks || []).map(async (block) => {
        const { data: userData } = await adminClient.auth.admin.getUserById(block.user_id);
        return { ...block, user_email: userData?.user?.email || 'Desconocido' };
      }));

      return new Response(
        JSON.stringify({ blocks: enriched }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UNBLOCK USER
    if (req.method === 'POST' && action === 'unblock') {
      const { blockId, userId } = await req.json();

      let unblockedIPs: string[] = [];

      if (blockId) {
        // Get the block's IP before updating
        const { data: blockData } = await adminClient
          .from('login_security_blocks')
          .select('ip_address')
          .eq('id', blockId)
          .single();
        if (blockData?.ip_address) unblockedIPs.push(blockData.ip_address);

        const { error: unblockError } = await adminClient
          .from('login_security_blocks')
          .update({ is_active: false, resolved_at: new Date().toISOString(), resolved_by: user.id })
          .eq('id', blockId);
        if (unblockError) throw unblockError;
      } else if (userId) {
        // Get all active block IPs for this user
        const { data: blocksData } = await adminClient
          .from('login_security_blocks')
          .select('ip_address')
          .eq('user_id', userId)
          .eq('is_active', true);
        unblockedIPs = (blocksData || []).map(b => b.ip_address).filter(Boolean);

        const { error: unblockError } = await adminClient
          .from('login_security_blocks')
          .update({ is_active: false, resolved_at: new Date().toISOString(), resolved_by: user.id })
          .eq('user_id', userId)
          .eq('is_active', true);
        if (unblockError) throw unblockError;
      } else {
        return new Response(
          JSON.stringify({ error: 'blockId or userId required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Add unblocked IPs to whitelist so they are never auto-blocked again
      for (const ipAddr of unblockedIPs) {
        await adminClient
          .from('ip_whitelist')
          .upsert(
            { ip_address: ipAddr, reason: 'Desbloqueado manualmente por admin', added_by: user.id },
            { onConflict: 'ip_address' }
          );
      }

      return new Response(
        JSON.stringify({ message: 'User unblocked successfully', whitelisted_ips: unblockedIPs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CHECK USER BLOCKS (for admin users panel)
    if (req.method === 'GET' && action === 'check-blocks') {
      const targetUserId = new URL(req.url).searchParams.get('userId');
      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: 'userId required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: activeBlock } = await adminClient
        .from('login_security_blocks')
        .select('id, reason, expires_at')
        .eq('user_id', targetUserId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      return new Response(
        JSON.stringify({ blocked: !!activeBlock, block: activeBlock }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // BLOCK IP - manually block an IP address
    if (req.method === 'POST' && action === 'block-ip') {
      const { ip_address, reason, user_email, duration_hours } = await req.json();

      if (!ip_address || !reason) {
        return new Response(
          JSON.stringify({ error: 'ip_address and reason are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find user_id by email if provided, otherwise use a placeholder
      let targetUserId = user.id;
      if (user_email) {
        const { data: { users } } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const found = users?.find(u => u.email === user_email);
        if (found) targetUserId = found.id;
      }

      const hours = duration_hours || 24;
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

      const { error: blockError } = await adminClient.from('login_security_blocks').insert({
        user_id: targetUserId,
        ip_address,
        reason: `[Bloqueo manual por IA] ${reason}`,
        alert_details: { blocked_by: user.email, source: 'ai_analysis', original_reason: reason },
        expires_at: expiresAt,
        is_active: true,
      });

      if (blockError) throw blockError;

      return new Response(
        JSON.stringify({ message: `IP ${ip_address} bloqueada por ${hours}h`, expires_at: expiresAt }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Admin users error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
