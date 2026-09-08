// Hourly poller: looks for newly submitted quality reviews on the read-only
// iSchool replica and notifies the tutor's team leader + all admins.
// The replica is read-only, so there is no trigger — we keep a checkpoint
// (last seen review id / time) in app_settings.
import postgres from "npm:postgres@3.4.5";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { RDS_CA } from "../_shared/rdsCa.ts";

const APP_DB_URL = Deno.env.get("SUPABASE_DB_URL")?.trim();
const REPLICA_HOST = Deno.env.get("ISCHOOL_REPLICA_HOST")?.trim();
const REPLICA_USER = Deno.env.get("ISCHOOL_REPLICA_USER")?.trim();
const REPLICA_PASSWORD = Deno.env.get("ISCHOOL_REPLICA_PASSWORD") ?? "";
const REPLICA_DB = Deno.env.get("ISCHOOL_REPLICA_DB")?.trim();
const REPLICA_PORT = Number(Deno.env.get("ISCHOOL_REPLICA_PORT") ?? "5432");

const CHECKPOINT_KEY = "quality_reviews_last_seen_at";
const MAX_PER_RUN = 200;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type ReviewRow = {
  id: string;
  score: string | null;
  submitted_at: string;
  tutor_name: string | null;
  tutor_tid: string | null;
  team_leader: string | null;
  needs_immediate_action: boolean;
  needs_coaching: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!APP_DB_URL) return json({ error: "App database not configured" }, 500);
  if (!REPLICA_HOST || !REPLICA_USER || !REPLICA_DB) {
    return json({ error: "Replica connection is not configured" }, 500);
  }

  const app = postgres(APP_DB_URL, { prepare: false, max: 1, idle_timeout: 5 });
  const replica = postgres({
    host: REPLICA_HOST,
    port: REPLICA_PORT,
    database: REPLICA_DB,
    username: REPLICA_USER,
    password: REPLICA_PASSWORD,
    ssl: { ca: RDS_CA, rejectUnauthorized: false },
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
    prepare: false,
    connection: { statement_timeout: "20s" },
  });

  try {
    // 1. Load checkpoint (default: last 24h on first run so we don't flood)
    const cp = await app<{ value: string | null }[]>`
      select value from public.app_settings where key = ${CHECKPOINT_KEY}
    `;
    const since = cp[0]?.value
      ? new Date(cp[0].value)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 2. Fetch reviews submitted since then
    const rows = await replica<ReviewRow[]>`
      select qr.id::text as id,
             qr.score::text as score,
             coalesce(qr.submission_date, qr.updated_at, qr.created_at) as submitted_at,
             (t.name_i18n->>'en') as tutor_name,
             t.t_id as tutor_tid,
             a.name as team_leader,
             qr.needs_immediate_action,
             qr.needs_coaching
      from public.quality_reviews qr
      join public.tutors t on t.id = qr.tutor_id
      left join public.admins a on a.id = t.team_lead_id
      where qr.type = 'QualityReview'
        and qr.status::text = '1'
        and coalesce(qr.submission_date, qr.updated_at, qr.created_at) > ${since.toISOString()}::timestamptz
      order by coalesce(qr.submission_date, qr.updated_at, qr.created_at) asc
      limit ${MAX_PER_RUN}
    `;

    if (rows.length === 0) {
      return json({ ok: true, since: since.toISOString(), new_reviews: 0, notifications: 0 });
    }

    // 3. Recipients: all admins + the tutor's team leader(s)
    const admins = await app<{ user_id: string }[]>`
      select user_id from public.user_roles where role = 'admin'::app_role
    `;
    const adminIds = admins.map((r) => r.user_id);

    let inserted = 0;
    let latest = since;
    for (const r of rows) {
      const submitted = new Date(r.submitted_at);
      if (submitted > latest) latest = submitted;

      const link = `/performance?tab=quality&review=${r.id}`;
      const tag = r.needs_immediate_action ? " — immediate action" : r.needs_coaching ? " — needs coaching" : "";
      const message = `New quality review for ${r.tutor_name ?? "tutor"} (${r.tutor_tid ?? ""}) scored ${
        r.score != null ? Number(r.score).toFixed(2) : "—"
      }/5${tag}`;

      const recipients = new Set<string>(adminIds);
      if (r.team_leader) {
        const tls = await app<{ find_team_leader_user_ids: string }[]>`
          select public.find_team_leader_user_ids(${r.team_leader})
        `;
        for (const t of tls) recipients.add(t.find_team_leader_user_ids);
      }

      for (const uid of recipients) {
        // Idempotent per (user, review link)
        const res = await app`
          insert into public.notifications (user_id, type, message, link)
          select ${uid}::uuid, 'quality_review_new', ${message}, ${link}
          where not exists (
            select 1 from public.notifications n
            where n.user_id = ${uid}::uuid and n.type = 'quality_review_new' and n.link = ${link}
          )
        `;
        inserted += res.count ?? 0;
      }
    }

    // 4. Advance checkpoint
    await app`
      insert into public.app_settings (key, value, updated_at)
      values (${CHECKPOINT_KEY}, ${latest.toISOString()}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;

    return json({
      ok: true,
      since: since.toISOString(),
      until: latest.toISOString(),
      new_reviews: rows.length,
      notifications: inserted,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "check failed";
    console.error("check-new-quality-reviews error:", msg);
    return json({ error: msg }, 500);
  } finally {
    await Promise.allSettled([app.end({ timeout: 5 }), replica.end({ timeout: 5 })]);
  }
});
