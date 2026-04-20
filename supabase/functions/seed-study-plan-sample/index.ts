import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const weekStart: string = body.week_start;
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return new Response(
        JSON.stringify({ error: "week_start (YYYY-MM-DD) required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: modules } = await admin
      .from("study_modules")
      .select("id, display_order")
      .order("display_order");
    if (!modules || modules.length === 0) {
      return new Response(JSON.stringify({ error: "No modules" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sampleTutors = [
      { id: "T-1001", name: "Sample Tutor Alpha", tl: "TL Demo", sessions: 18 },
      { id: "T-1002", name: "Sample Tutor Beta", tl: "TL Demo", sessions: 20 },
      { id: "T-1003", name: "Sample Tutor Gamma", tl: "TL Demo", sessions: 23 },
      { id: "T-1004", name: "Sample Tutor Delta", tl: "TL Demo", sessions: 12 },
    ];

    const occRows = sampleTutors.map((t) => ({
      tutor_external_id: t.id,
      tutor_name: t.name,
      team_leader: t.tl,
      week_start: weekStart,
      phase: "pre",
      scheduled_sessions: t.sessions,
      source: "sample",
    }));

    await admin
      .from("tutor_weekly_occupation")
      .upsert(occRows, { onConflict: "tutor_external_id,week_start,phase" });

    // Each sample tutor gets 6 unfinished modules from across the catalog
    const pickedModuleIds = modules
      .filter((_, i) => i % 4 === 0)
      .slice(0, 6)
      .map((m) => m.id);

    const pubRows = sampleTutors.flatMap((t) =>
      pickedModuleIds.map((mid) => ({
        tutor_external_id: t.id,
        tutor_name: t.name,
        team_leader: t.tl,
        week_start: weekStart,
        phase: "pre",
        module_id: mid,
        is_assigned: true,
        is_finished: false,
      })),
    );
    await admin
      .from("tutor_published_modules")
      .upsert(pubRows, {
        onConflict: "tutor_external_id,week_start,phase,module_id",
      });

    return new Response(
      JSON.stringify({
        success: true,
        tutors: sampleTutors.length,
        modules_per_tutor: pickedModuleIds.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
