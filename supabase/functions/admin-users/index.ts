import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = 'administracion@malagamicro.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the JWT from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user's JWT using anon client
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is the admin
    if (user.email !== ADMIN_EMAIL) {
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin only.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

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

      // Get roles for each user
      const { data: roles } = await adminClient
        .from('user_roles')
        .select('user_id, role');

      const rolesMap = new Map();
      roles?.forEach(r => {
        if (!rolesMap.has(r.user_id)) {
          rolesMap.set(r.user_id, []);
        }
        rolesMap.get(r.user_id).push(r.role);
      });

      const usersWithRoles = users.map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        email_confirmed_at: u.email_confirmed_at,
        last_sign_in_at: u.last_sign_in_at,
        roles: rolesMap.get(u.id) || []
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
        throw createError;
      }

      // Assign role if provided
      if (role && newUser.user) {
        await adminClient.from('user_roles').insert({
          user_id: newUser.user.id,
          role: role
        });
      }

      // Create profile for the user
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
    if (req.method === 'DELETE' && action === 'delete') {
      const { userId } = await req.json();

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Prevent deleting the admin account
      const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(userId);
      if (targetUser?.email === ADMIN_EMAIL) {
        return new Response(
          JSON.stringify({ error: 'Cannot delete the admin account' }),
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

    // SET ROLE
    if (req.method === 'POST' && action === 'set-role') {
      const { userId, role } = await req.json();

      if (!userId || !role) {
        return new Response(
          JSON.stringify({ error: 'User ID and role are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Remove existing roles
      await adminClient.from('user_roles').delete().eq('user_id', userId);

      // Add new role
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