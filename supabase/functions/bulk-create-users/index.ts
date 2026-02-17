import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserToCreate {
  email: string;
  password: string;
  role: "admin" | "team_leader" | "mentor";
  mentor_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { users } = await req.json() as { users: UserToCreate[] };

    if (!users || !Array.isArray(users)) {
      return new Response(
        JSON.stringify({ error: "Missing 'users' array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const user of users) {
      try {
        // Look up the profile by email to get user_id and other info
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("user_id, mentor_id, mentor_name, full_name, team_leader")
          .eq("email", user.email)
          .maybeSingle();

        // Also try matching by mentor_id if provided
        let profileByMentorId = null;
        if (!profile && user.mentor_id) {
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("user_id, mentor_id, mentor_name, full_name, team_leader, email")
            .eq("mentor_id", user.mentor_id)
            .maybeSingle();
          profileByMentorId = data;
        }

        const matchedProfile = profile || profileByMentorId;

        if (!matchedProfile) {
          results.push({ email: user.email, success: false, error: "No profile found" });
          continue;
        }

        // Check if auth user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existing = existingUsers?.users?.find(u => u.email === user.email);

        if (existing) {
          // Update password for existing user
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            existing.id,
            { password: user.password, email_confirm: true }
          );
          if (updateError) {
            results.push({ email: user.email, success: false, error: `Update failed: ${updateError.message}` });
          } else {
            // Make sure profile links to this auth user
            await supabaseAdmin.from("profiles").update({ user_id: existing.id }).eq("id", matchedProfile.user_id === existing.id ? matchedProfile.user_id : matchedProfile.user_id);
            results.push({ email: user.email, success: true, error: "Updated existing user" });
          }
          continue;
        }

        // Create new auth user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
        });

        if (createError) {
          results.push({ email: user.email, success: false, error: createError.message });
          continue;
        }

        // Update the profile to link to the new auth user_id
        await supabaseAdmin
          .from("profiles")
          .update({ user_id: newUser.user.id, email: user.email })
          .eq("user_id", matchedProfile.user_id);

        // Update user_roles to link to new auth user_id
        await supabaseAdmin
          .from("user_roles")
          .update({ user_id: newUser.user.id })
          .eq("user_id", matchedProfile.user_id);

        // Update tasks to link to new auth user_id
        await supabaseAdmin
          .from("tasks")
          .update({ user_id: newUser.user.id })
          .eq("user_id", matchedProfile.user_id);

        // Set role if not default mentor
        if (user.role !== "mentor") {
          await supabaseAdmin
            .from("user_roles")
            .update({ role: user.role })
            .eq("user_id", newUser.user.id);
        }

        results.push({ email: user.email, success: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        results.push({ email: user.email, success: false, error: msg });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
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
