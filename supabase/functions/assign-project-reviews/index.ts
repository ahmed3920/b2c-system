// Daily random assignment of student projects to QC reviewers.
// - Reviewers = everyone on public.project_audit_access
// - Each reviewer is topped up to the daily limit of open assignments
// - Candidates come from the read-only iSchool replica, excluding projects
//   that are already assigned or already evaluated.
import postgres from "npm:postgres@3.4.5";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { RDS_CA } from "../_shared/rdsCa.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const APP_DB_URL = Deno.env.get("SUPABASE_DB_URL")?.trim();

const REPLICA_HOST = Deno.env.get("ISCHOOL_REPLICA_HOST")?.trim();
const REPLICA_USER = Deno.env.get("ISCHOOL_REPLICA_USER")?.trim();
const REPLICA_PASSWORD = Deno.env.get("ISCHOOL_REPLICA_PASSWORD") ?? "";
const REPLICA_DB = Deno.env.get("ISCHOOL_REPLICA_DB")?.trim();
const REPLICA_PORT = Number(Deno.env.get("ISCHOOL_REPLICA_PORT") ?? "5432");

const DEFAULT_LIMIT = 10;
const POOL_DAYS = 90;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function userIdFrom(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  try {
    const jwks = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
    const { payload } = await jwtVerify(authHeader.slice(7), jwks, { clockTolerance: 600 });
    return (payload.sub as string) ?? null;
  } catch (_e) {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: authHeader, apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
      });
      if (!res.ok) return null;
      const user = await res.json();
      return user?.id ?? null;
    } catch (_e2) {
      return null;
    }
  }
}

type PoolRow = {
  project_id: number;
  title: string | null;
  created_at: string;
  s_id: string | null;
  student_name: string | null;
  grade: string | null;
  tutor_tid: string | null;
  tutor_name: string | null;
  team_leader: string;
  group_session_id: number | null;
  has_url: boolean;
};

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Random order that spreads picks across different groups first. */
function spreadByGroup(rows: PoolRow[]): PoolRow[] {
  const buckets = new Map<string, PoolRow[]>();
  for (const r of shuffle(rows)) {
    const key = r.group_session_id ? `g${r.group_session_id}` : `s${r.project_id}`;
    const list = buckets.get(key) ?? [];
    list.push(r);
    buckets.set(key, list);
  }
  const keys = shuffle([...buckets.keys()]);
  const out: PoolRow[] = [];
  let more = true;
  while (more) {
    more = false;
    for (const k of keys) {
      const list = buckets.get(k)!;
      const next = list.shift();
      if (next) {
        out.push(next);
        if (list.length) more = true;
      }
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!APP_DB_URL) return json({ error: "App database not configured" }, 500);
  if (!REPLICA_HOST || !REPLICA_USER || !REPLICA_DB) {
    return json({ error: "Replica connection is not configured" }, 500);
  }

  const app = postgres(APP_DB_URL, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    // A signed-in caller must be an admin; a call with no user token is the
    // scheduled run, which can only top up today's batch (idempotent).
    const userId = await userIdFrom(req);
    if (userId) {
      const roles = await app<{ role: string }[]>`
        select role::text as role from public.user_roles where user_id = ${userId}
      `;
      if (!roles.some((r) => r.role === "admin")) {
        return json({ error: "Admin access required" }, 403);
      }
    }

    const settings = await app<{ value: string }[]>`
      select value from public.app_settings where key = 'project_review_daily_limit' limit 1
    `;
    const dailyLimit = Math.max(1, Math.min(200, Number(settings[0]?.value ?? DEFAULT_LIMIT) || DEFAULT_LIMIT));

    const reviewers = await app<{ user_id: string; full_name: string | null }[]>`
      select a.user_id::text as user_id, p.full_name
        from public.project_audit_access a
        left join public.profiles p on p.user_id = a.user_id
    `;
    if (!reviewers.length) {
      return json({ assigned: 0, reviewers: 0, daily_limit: dailyLimit, message: "No reviewers on the access list" });
    }

    const openCounts = await app<{ assigned_to: string; open: number }[]>`
      select assigned_to::text as assigned_to, count(*)::int as open
        from public.project_review_assignments
       where state = 'open'
       group by 1
    `;
    const openMap = new Map(openCounts.map((r) => [r.assigned_to, Number(r.open)]));

    const need = reviewers
      .map((r) => ({ ...r, need: dailyLimit - (openMap.get(r.user_id) ?? 0) }))
      .filter((r) => r.need > 0);
    const totalNeed = need.reduce((s, r) => s + r.need, 0);
    if (!totalNeed) {
      return json({ assigned: 0, reviewers: reviewers.length, daily_limit: dailyLimit, message: "Everyone is already at the daily limit" });
    }

    const taken = await app<{ project_id: string }[]>`
      select project_id::text as project_id from public.project_review_assignments
      union
      select project_id::text from public.project_evaluations
    `;
    const excluded = new Set(taken.map((t) => t.project_id));

    const replica = postgres({
      host: REPLICA_HOST,
      port: REPLICA_PORT,
      database: REPLICA_DB,
      username: REPLICA_USER,
      password: REPLICA_PASSWORD,
      ssl: { ca: RDS_CA, rejectUnauthorized: false },
      max: 1,
      idle_timeout: 5,
      prepare: false,
    });

    let pool: PoolRow[] = [];
    try {
      pool = (await replica<PoolRow[]>`
        select p.id as project_id,
               p.title,
               p.created_at,
               st.s_id,
               coalesce(st.name_en, st.name) as student_name,
               coalesce(g.name_i18n->>'en', g.name) as grade,
               t.t_id as tutor_tid,
               coalesce(t.name_i18n->>'en', t.name_temp) as tutor_name,
               btrim(coalesce(a.name, 'Unassigned')) as team_leader,
               s.group_session_id,
               (coalesce(btrim(p.url), '') <> '') as has_url
          from public.projects p
          join public.students st on st.id = p.student_id
          left join public.grades g on g.id = st.grade_id
          left join public.sessions s on s.id = p.session_id
          left join public.tutors t on t.id = s.tutor_id
          left join public.admins a on a.id = t.team_lead_id
         where st.organization_id = 1
           and p.created_at >= now() - ${`${POOL_DAYS} days`}::interval
         order by p.created_at desc
         limit 4000
      `) as unknown as PoolRow[];
    } finally {
      await replica.end({ timeout: 5 });
    }

    // Projects that carry a shareable link come first — they can actually be opened.
    const usable = pool.filter((r) => !excluded.has(String(r.project_id)));
    const candidates = [
      ...spreadByGroup(usable.filter((r) => r.has_url)),
      ...spreadByGroup(usable.filter((r) => !r.has_url)),
    ];

    if (!candidates.length) {
      return json({ assigned: 0, reviewers: reviewers.length, daily_limit: dailyLimit, message: "No new projects to assign" });
    }

    const today = new Date().toISOString().slice(0, 10);
    let cursor = 0;
    let assigned = 0;
    const perReviewer: Record<string, number> = {};

    for (const reviewer of need) {
      for (let i = 0; i < reviewer.need && cursor < candidates.length; i++) {
        const row = candidates[cursor++];
        await app`
          insert into public.project_review_assignments
            (project_id, assigned_to, assigned_to_name, assigned_on, state, student_external_id,
             student_name, grade, tutor_external_id, tutor_name, team_leader, project_title,
             project_created_at, group_key)
          values (${row.project_id}, ${reviewer.user_id}, ${reviewer.full_name}, ${today}, 'open',
                  ${row.s_id}, ${row.student_name}, ${row.grade}, ${row.tutor_tid}, ${row.tutor_name},
                  ${row.team_leader}, ${row.title}, ${row.created_at},
                  ${row.group_session_id ? String(row.group_session_id) : null})
          on conflict (project_id) do nothing
        `;
        assigned++;
        perReviewer[reviewer.user_id] = (perReviewer[reviewer.user_id] ?? 0) + 1;
      }
    }

    return json({ assigned, reviewers: reviewers.length, daily_limit: dailyLimit, per_reviewer: perReviewer });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Assignment failed" }, 500);
  } finally {
    await app.end({ timeout: 5 });
  }
});
