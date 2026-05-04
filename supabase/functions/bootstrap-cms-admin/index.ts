import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, { auth: { persistSession: false } });

    const email = "admin@cms.com";
    const password = "admin123";
    const fullName = "CMS Admin";

    let userId: string | undefined;
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error) {
      // find existing
      let page = 1;
      while (page < 20) {
        const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        const found = list?.users.find((u) => u.email === email);
        if (found) { userId = found.id; break; }
        if (!list || list.users.length < 1000) break;
        page++;
      }
      if (!userId) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      userId = created.user!.id;
    }

    await admin.from("user_systems").upsert({ user_id: userId, system: "cms" }, { onConflict: "user_id" });
    await admin.from("cms_profiles").upsert({ user_id: userId, full_name: fullName, email, active_status: true }, { onConflict: "user_id" });
    await admin.from("cms_user_roles").upsert({ user_id: userId, role: "cms_admin" }, { onConflict: "user_id,role" });

    return new Response(JSON.stringify({ success: true, userId, email, password }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
