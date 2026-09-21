import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Missing authorization header" }, 401);

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Invalid token" }, 401);

    const requestingUserId = claimsData.claims.sub as string;
    console.log("delete-user request by", requestingUserId);

    const { data: roleRows, error: roleError } = await admin
      .from("cms_user_roles")
      .select("role")
      .eq("user_id", requestingUserId);
    if (roleError) {
      console.error("role lookup failed", roleError);
      return json({ error: `Role lookup failed: ${roleError.message}` }, 500);
    }
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    console.log("roles found", JSON.stringify(roles));
    if (!roles.includes("cms_admin")) {
      return json({ error: `Unauthorized: CMS Admin required (your roles: ${roles.join(", ") || "none"})` }, 403);
    }


    const body = await req.json();
    const userId = String(body.userId ?? "");
    if (!userId) return json({ error: "Missing userId" }, 400);
    if (userId === requestingUserId) return json({ error: "You cannot delete your own account" }, 400);

    // Remove CMS-side records first (no FK cascade guaranteed)
    await admin.from("cms_task_assignees").delete().eq("user_id", userId);
    await admin.from("cms_user_roles").delete().eq("user_id", userId);
    await admin.from("cms_profiles").delete().eq("user_id", userId);
    await admin.from("user_systems").delete().eq("user_id", userId);

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) return json({ error: deleteError.message }, 400);

    return json({ success: true }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
