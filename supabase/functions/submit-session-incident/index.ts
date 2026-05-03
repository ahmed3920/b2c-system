import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Payload {
  token?: string;
  tutor_external_id?: string;
  student_id?: string;
  student_name?: string;
  student_grade?: string;
  session_date?: string;
  session_number?: string;
  case_category?: string;
  case_description?: string;
  supporting_link?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as Payload;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let tutorExternalId = (body.tutor_external_id || "").trim();
    let tutorName = "";
    let teamLeader = "";
    let assignedMentor = "";
    let tokenId: string | null = null;

    if (body.token) {
      const { data: tok } = await supabase
        .from("session_incident_tokens")
        .select("*")
        .eq("token", body.token)
        .eq("is_active", true)
        .maybeSingle();
      if (!tok) {
        return new Response(JSON.stringify({ error: "Invalid or expired link" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      tutorExternalId = tok.tutor_external_id;
      tutorName = tok.tutor_name;
      teamLeader = tok.team_leader;
      tokenId = tok.id;
    }

    if (!tutorExternalId) {
      return new Response(JSON.stringify({ error: "Tutor ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.case_category) {
      return new Response(JSON.stringify({ error: "Case category required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If we don't have tutor info from token, look it up via roster mirror table or accept submitted-only.
    // We'll pass tutorName/teamLeader from client if they provided them (lookup happens client-side via tutorRoster).
    if (!tutorName) tutorName = (body as any).tutor_name || tutorExternalId;
    if (!teamLeader) teamLeader = (body as any).team_leader || "Unknown";
    if (!assignedMentor) assignedMentor = (body as any).assigned_mentor_name || "";

    const { data, error } = await supabase
      .from("session_incidents")
      .insert({
        tutor_external_id: tutorExternalId,
        tutor_name: tutorName,
        team_leader: teamLeader,
        assigned_mentor_name: assignedMentor || null,
        student_id: body.student_id || null,
        student_name: body.student_name || null,
        student_grade: body.student_grade || null,
        session_date: body.session_date || null,
        session_number: body.session_number || null,
        case_category: body.case_category,
        case_description: body.case_description || null,
        supporting_link: body.supporting_link || null,
        source: "tutor_self",
        validation_status: "pending",
        token_id: tokenId,
      })
      .select()
      .single();

    if (error) throw error;

    if (tokenId) {
      await supabase
        .from("session_incident_tokens")
        .update({ last_used_at: new Date().toISOString(), use_count: ((data as any).use_count || 0) + 1 })
        .eq("id", tokenId);
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
