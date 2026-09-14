// Daily snapshot of student project uploads (zero-project students).
// Reads the iSchool replica and upserts one row per day into
// public.project_upload_snapshots. Safe to run multiple times a day.
import postgres from "npm:postgres@3.4.5";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { RDS_CA } from "../_shared/rdsCa.ts";

const APP_DB_URL = Deno.env.get("SUPABASE_DB_URL")?.trim();
const REPLICA_HOST = Deno.env.get("ISCHOOL_REPLICA_HOST")?.trim();
const REPLICA_USER = Deno.env.get("ISCHOOL_REPLICA_USER")?.trim();
const REPLICA_PASSWORD = Deno.env.get("ISCHOOL_REPLICA_PASSWORD") ?? "";
const REPLICA_DB = Deno.env.get("ISCHOOL_REPLICA_DB")?.trim();
const REPLICA_PORT = Number(Deno.env.get("ISCHOOL_REPLICA_PORT") ?? "5432");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BASE = `with base as (
    select (select count(*) from public.projects p where p.student_id = s.id)::int as projects_count,
           coalesce(g.name_i18n->>'en', g.name) as grade,
           btrim(coalesce(a.name, 'Unassigned')) as team_leader
      from public.students s
      left join public.tutors tt on tt.id = s.next_session_tutor_id
      left join public.admins a on a.id = tt.team_lead_id
      left join public.grades g on g.id = coalesce(s.next_session_grade_id, s.grade_id)
     where s.organization_id = 1
       and s.next_session_id is not null
       and coalesce(s.total_attended_sessions_count, 0) > 0
  )`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!APP_DB_URL) return json({ error: "App database not configured" }, 500);
  if (!REPLICA_HOST || !REPLICA_USER || !REPLICA_DB) {
    return json({ error: "Replica connection is not configured" }, 500);
  }

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
    connection: { statement_timeout: "60s" },
  });
  const app = postgres(APP_DB_URL, { prepare: false, max: 1, idle_timeout: 5 });

  try {
    const totals = await replica.unsafe(`${BASE}
      select count(*)::int as total_students,
             count(*) filter (where projects_count = 0)::int as zero_students
      from base`);
    const byGrade = await replica.unsafe(`${BASE}
      select coalesce(grade, 'Unknown') as grade,
             count(*) filter (where projects_count = 0)::int as zero_students,
             count(*)::int as students
      from base group by 1 order by 2 desc`);
    const byTl = await replica.unsafe(`${BASE}
      select team_leader,
             count(*) filter (where projects_count = 0)::int as zero_students,
             count(*)::int as students
      from base group by 1 order by 2 desc`);

    const row = totals[0] as { total_students: number; zero_students: number };

    await app`
      insert into public.project_upload_snapshots
        (snapshot_date, zero_students, total_students, by_grade, by_team_leader)
      values (
        (now() at time zone 'utc')::date,
        ${row.zero_students},
        ${row.total_students},
        ${JSON.stringify(Array.from(byGrade))}::jsonb,
        ${JSON.stringify(Array.from(byTl))}::jsonb
      )
      on conflict (snapshot_date) do update set
        zero_students = excluded.zero_students,
        total_students = excluded.total_students,
        by_grade = excluded.by_grade,
        by_team_leader = excluded.by_team_leader,
        updated_at = now()
    `;

    return json({ ok: true, ...row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Snapshot failed";
    console.error("snapshot-project-uploads error:", msg);
    return json({ error: msg }, 500);
  } finally {
    await replica.end({ timeout: 5 });
    await app.end({ timeout: 5 });
  }
});
