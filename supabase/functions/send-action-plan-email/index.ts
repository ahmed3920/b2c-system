import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  to: string;
  cc?: string | null;
  subject: string;
  body: string;
  team_leader: string;
  related_plan_id?: string | null;
  template_id?: string | null;
  tutor_external_id?: string | null;
  tutor_name?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const payload = (await req.json()) as Payload;
    if (!payload.to || !payload.subject || !payload.body || !payload.team_leader) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Look up TL email (Reply-To)
    const { data: tlRow } = await admin
      .from("team_leader_emails")
      .select("email,is_active,team_leader_name")
      .ilike("team_leader_name", payload.team_leader)
      .maybeSingle();

    const replyTo = tlRow?.email ?? null;

    // Sender name
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle();

    const ccList = payload.cc
      ? payload.cc.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // Try to send via Lovable Emails (Resend connector through gateway)
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    let status: "sent" | "failed" = "failed";
    let errorMessage: string | null = null;
    let fromEmail = "no-reply@b2c-system.lovable.app";

    if (lovableKey && resendKey) {
      try {
        const fromName = payload.team_leader || profile?.full_name || "B2C System";
        const sendBody: Record<string, unknown> = {
          from: `${fromName} <${fromEmail}>`,
          to: [payload.to],
          subject: payload.subject,
          text: payload.body,
        };
        if (ccList.length) sendBody.cc = ccList;
        if (replyTo) sendBody.reply_to = replyTo;

        const r = await fetch(
          "https://connector-gateway.lovable.dev/resend/emails",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lovableKey}`,
              "X-Connection-Api-Key": resendKey,
            },
            body: JSON.stringify(sendBody),
          },
        );
        if (r.ok) {
          status = "sent";
        } else {
          errorMessage = `Provider ${r.status}: ${await r.text()}`;
        }
      } catch (e) {
        errorMessage = (e as Error).message;
      }
    } else {
      errorMessage =
        "Email provider not configured. A workspace admin must verify a sending domain (Lovable Emails / Resend) before emails can be sent.";
    }

    // Always log
    await admin.from("email_logs").insert({
      tutor_external_id: payload.tutor_external_id ?? null,
      tutor_name: payload.tutor_name ?? null,
      recipient_email: payload.to,
      cc_emails: payload.cc ?? null,
      subject: payload.subject,
      body: payload.body,
      status,
      related_plan_id: payload.related_plan_id ?? null,
      template_id: payload.template_id ?? null,
      sent_by: userId,
      sent_by_name: profile?.full_name ?? null,
      reply_to: replyTo,
      from_email: fromEmail,
      error_message: errorMessage,
    });

    if (status === "failed") {
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          reply_to: replyTo,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ success: true, reply_to: replyTo, from: fromEmail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
