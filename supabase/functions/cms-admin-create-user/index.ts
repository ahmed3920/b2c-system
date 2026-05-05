import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CmsRole = "cms_admin" | "cms_supervisor" | "cms_member";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Missing authorization header" }, 401);
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Invalid token" }, 401);

    const requestingUserId = claimsData.claims.sub as string;

    // Verify caller is a CMS admin
    const { data: roleRow } = await supabaseAdmin
      .from("cms_user_roles")
      .select("role")
      .eq("user_id", requestingUserId)
      .eq("role", "cms_admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Unauthorized: CMS Admin required" }, 403);

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.fullName ?? "").trim();
    const role: CmsRole = (body.role ?? "cms_member") as CmsRole;
    const title = body.title ? String(body.title) : null;

    if (!email || !password || !fullName) return json({ error: "Missing required fields" }, 400);
    if (!["cms_admin", "cms_supervisor", "cms_member"].includes(role)) {
      return json({ error: "Invalid role" }, 400);
    }
    if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !newUser?.user) return json({ error: createError?.message ?? "Create failed" }, 400);

    const userId = newUser.user.id;

    // Tag user as CMS
    const { error: sysError } = await supabaseAdmin
      .from("user_systems")
      .upsert({ user_id: userId, system: "cms" }, { onConflict: "user_id" });
    if (sysError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return json({ error: sysError.message }, 400);
    }

    // Create CMS profile
    const { error: profileError } = await supabaseAdmin
      .from("cms_profiles")
      .insert({ user_id: userId, full_name: fullName, email, active_status: true });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return json({ error: profileError.message }, 400);
    }

    // Assign CMS role + title
    const { error: roleError } = await supabaseAdmin
      .from("cms_user_roles")
      .insert({ user_id: userId, role, title });
    if (roleError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return json({ error: roleError.message }, 400);
    }

    return json({ success: true, userId, user: { id: userId, email } }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
