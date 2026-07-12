import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
import postgres from "npm:postgres@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const validRoles = new Set(["admin", "team_leader", "super_team_leader", "mentor", "community_moderator"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const databaseUrl = Deno.env.get("SUPABASE_DB_URL")!;
    const db = postgres(databaseUrl, { max: 1, ssl: "require" });
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    let requestingUserId: string;

    try {
      const JWKS = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
      const { payload } = await jwtVerify(token, JWKS, {
        clockTolerance: 600,
      });

      if (!payload.sub) {
        throw new Error("Missing user id in token");
      }

      requestingUserId = payload.sub;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid token";
      return new Response(
        JSON.stringify({ error: message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is admin (user may have multiple roles).
    // Use the service client here because the caller JWT can be slightly ahead
    // of the edge runtime clock; getUser() already validated the token with auth.
    const roleRows = await db`
      SELECT role::text AS role
      FROM public.user_roles
      WHERE user_id = ${requestingUserId}
        AND role = 'admin'::public.app_role
      LIMIT 1
    `;

    if (!roleRows || roleRows.length === 0) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, fullName, mentorId, mentorName, teamLeader, role } = await req.json();
    const finalRole = role || "mentor";

    // Validate required fields
    if (!email || !password || !mentorId || !mentorName || !teamLeader) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!validRoles.has(finalRole)) {
      return new Response(
        JSON.stringify({ error: "Invalid role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      await db.begin(async (tx) => {
        await tx`
          INSERT INTO public.profiles (
            user_id,
            mentor_id,
            mentor_name,
            team_leader,
            full_name,
            email,
            active_status
          ) VALUES (
            ${newUser.user.id},
            ${mentorId},
            ${mentorName},
            ${teamLeader},
            ${fullName || mentorName},
            ${email},
            true
          )
        `;

        await tx`DELETE FROM public.user_roles WHERE user_id = ${newUser.user.id}`;
        await tx`
          INSERT INTO public.user_roles (user_id, role)
          VALUES (${newUser.user.id}, ${finalRole}::public.app_role)
          ON CONFLICT (user_id, role) DO NOTHING
        `;
      });
    } catch (profileError: unknown) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      const message = profileError instanceof Error ? profileError.message : "Failed to create profile";
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { 
          id: newUser.user.id, 
          email: newUser.user.email 
        } 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
