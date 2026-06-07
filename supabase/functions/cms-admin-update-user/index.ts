import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CmsRole = "cms_admin" | "cms_supervisor" | "cms_member";

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

    const { data: roleRow } = await admin
      .from("cms_user_roles")
      .select("role")
      .eq("user_id", requestingUserId)
      .eq("role", "cms_admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Unauthorized: CMS Admin required" }, 403);

    const body = await req.json();
    const userId = String(body.userId ?? "");
    if (!userId) return json({ error: "Missing userId" }, 400);

    const newEmail = body.email ? String(body.email).trim().toLowerCase() : null;
    const newPassword = body.password ? String(body.password) : null;
    const newFullName = body.fullName !== undefined ? String(body.fullName).trim() : null;
    const newRole = body.role ? (String(body.role) as CmsRole) : null;
    const newTitle = body.title !== undefined ? (body.title ? String(body.title) : null) : undefined;
    const activeStatus = typeof body.activeStatus === "boolean" ? body.activeStatus : null;

    // Auth update (email/password)
    if (newEmail || newPassword) {
      const updates: Record<string, unknown> = {};
      if (newEmail) {
        updates.email = newEmail;
        updates.email_confirm = true;
      }
      if (newPassword) {
        if (newPassword.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
        updates.password = newPassword;
      }
      const { error } = await admin.auth.admin.updateUserById(userId, updates);
      if (error) return json({ error: error.message }, 400);
    }

    // Profile update
    const profileUpdates: Record<string, unknown> = {};
    if (newEmail) profileUpdates.email = newEmail;
    if (newFullName !== null) profileUpdates.full_name = newFullName;
    if (activeStatus !== null) profileUpdates.active_status = activeStatus;
    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await admin.from("cms_profiles").update(profileUpdates).eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
    }

    // Role/title update
    if (newRole || newTitle !== undefined) {
      if (newRole && !["cms_admin", "cms_supervisor", "cms_member"].includes(newRole)) {
        return json({ error: "Invalid role" }, 400);
      }
      const { data: existing } = await admin
        .from("cms_user_roles")
        .select("role, title")
        .eq("user_id", userId)
        .maybeSingle();
      const finalRole = newRole ?? (existing?.role as CmsRole | undefined) ?? "cms_member";
      const finalTitle = newTitle !== undefined ? newTitle : (existing as { title?: string | null } | null)?.title ?? null;
      await admin.from("cms_user_roles").delete().eq("user_id", userId);
      const { error } = await admin
        .from("cms_user_roles")
        .insert({ user_id: userId, role: finalRole, title: finalTitle });
      if (error) return json({ error: error.message }, 400);
    }

    return json({ success: true }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
