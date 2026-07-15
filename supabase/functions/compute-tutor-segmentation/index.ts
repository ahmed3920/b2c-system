// Compute Tutor Segmentation snapshot.
// - Aggregates per-tutor signals from the last 90 days (recency-weighted)
// - Merges monthly manual ratings
// - Produces a Tutor Health Score, segment, trend, confidence, hard-stop, next action
// - Upserts today's snapshot into tutor_segmentation_scores
// - Regenerates open recommendations in tutor_segmentation_recommendations
import postgres from "npm:postgres@3.4.5";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const DATABASE_URL = Deno.env.get("SUPABASE_DB_URL")?.trim();

type Row = Record<string, any>;

// Weights (sum = 100)
const W = {
  quality: 30,
  planned_leaves: 5,
  emergency_leaves: 5,
  live_issues: 10,
  cs_tickets: 10,
  communication: 10,
  tl_feedback: 10,
  engagement: 10,
  parent_handling: 5,
  culture_fit: 5,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function recencyWeight(days: number): number {
  if (days <= 30) return 1.0;
  if (days <= 60) return 0.6;
  if (days <= 90) return 0.3;
  return 0;
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function dateOnly(value?: string | Date | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(str) ? str.slice(0, 10) : str;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Normalize team leader names to the 5 canonical values so filter dropdowns and
// group-bys don't show duplicates like "Ahmed Hesham  Helmy" vs "Ahmed Hesham Helmy"
// or "Anan Zewil" vs "Anan Mohammed Mohammed Zewil".
function normalizeTeamLeader(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim().replace(/\s+/g, " ");
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower.startsWith("ahmed")) return "Ahmed Hesham Helmy";
  if (lower.startsWith("anan")) return "Anan";
  if (lower.startsWith("kareem") || lower.startsWith("karim")) return "Kareem";
  if (lower.startsWith("nermeen") || lower.startsWith("nermin")) return "Nermeen";
  if (lower.startsWith("ghada")) return "Ghada";
  return s;
}

const CANONICAL_TLS = new Set(["Ahmed Hesham Helmy", "Anan", "Kareem", "Nermeen", "Ghada"]);


async function verifyAdmin(req: Request, sql: ReturnType<typeof postgres>) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { response: json({ error: "Unauthorized" }, 401), userId: null };
  }

  const token = authHeader.slice("Bearer ".length);
  let userId: string;
  try {
    const jwks = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, jwks, { clockTolerance: 600 });
    if (!payload.sub) throw new Error("Missing user id in token");
    userId = payload.sub;
  } catch (_error) {
    return { response: json({ error: "Unauthorized" }, 401), userId: null };
  }

  const roles = await sql<{ role: string }[]>`
    select role::text as role
    from public.user_roles
    where user_id = ${userId}
  `;
  if (!roles.some((r) => r.role === "admin")) {
    return { response: json({ error: "Admin access required" }, 403), userId: null };
  }

  return { response: null, userId };
}

async function upsertSnapshots(sql: ReturnType<typeof postgres>, snapshots: Row[]) {
  for (const chunk of chunks(snapshots, 500)) {
    await sql`
      insert into public.tutor_segmentation_scores (
        tutor_external_id, tutor_name, team_leader, language, snapshot_date,
        quality_score, planned_leaves_score, emergency_leaves_score, live_issues_score, cs_tickets_score,
        communication_score, tl_feedback_score, engagement_score, parent_handling_score, culture_fit_score,
        health_score, segment, trend, confidence, hard_stop_reason, next_action, metrics_meta
      )
      select
        tutor_external_id,
        tutor_name,
        team_leader,
        language,
        snapshot_date::date,
        quality_score,
        planned_leaves_score,
        emergency_leaves_score,
        live_issues_score,
        cs_tickets_score,
        communication_score,
        tl_feedback_score,
        engagement_score,
        parent_handling_score,
        culture_fit_score,
        health_score,
        segment::public.tutor_segment,
        trend::public.tutor_trend,
        confidence::public.tutor_confidence,
        hard_stop_reason,
        next_action,
        coalesce(metrics_meta, '{}'::jsonb)
      from jsonb_to_recordset(${sql.json(chunk)}::jsonb) as x(
        tutor_external_id text,
        tutor_name text,
        team_leader text,
        language text,
        snapshot_date text,
        quality_score numeric,
        planned_leaves_score numeric,
        emergency_leaves_score numeric,
        live_issues_score numeric,
        cs_tickets_score numeric,
        communication_score numeric,
        tl_feedback_score numeric,
        engagement_score numeric,
        parent_handling_score numeric,
        culture_fit_score numeric,
        health_score numeric,
        segment text,
        trend text,
        confidence text,
        hard_stop_reason text,
        next_action text,
        metrics_meta jsonb
      )
      on conflict (tutor_external_id, snapshot_date) do update set
        tutor_name = excluded.tutor_name,
        team_leader = excluded.team_leader,
        language = excluded.language,
        quality_score = excluded.quality_score,
        planned_leaves_score = excluded.planned_leaves_score,
        emergency_leaves_score = excluded.emergency_leaves_score,
        live_issues_score = excluded.live_issues_score,
        cs_tickets_score = excluded.cs_tickets_score,
        communication_score = excluded.communication_score,
        tl_feedback_score = excluded.tl_feedback_score,
        engagement_score = excluded.engagement_score,
        parent_handling_score = excluded.parent_handling_score,
        culture_fit_score = excluded.culture_fit_score,
        health_score = excluded.health_score,
        segment = excluded.segment,
        trend = excluded.trend,
        confidence = excluded.confidence,
        hard_stop_reason = excluded.hard_stop_reason,
        next_action = excluded.next_action,
        metrics_meta = excluded.metrics_meta,
        updated_at = now()
    `;
  }
}

async function insertRecommendations(sql: ReturnType<typeof postgres>, recommendations: Row[]) {
  for (const chunk of chunks(recommendations, 500)) {
    await sql`
      insert into public.tutor_segmentation_recommendations (
        tutor_external_id, tutor_name, team_leader, rule_id, title, description,
        severity, suggested_action, status, meta
      )
      select
        tutor_external_id,
        tutor_name,
        team_leader,
        rule_id,
        title,
        description,
        severity::public.recommendation_severity,
        suggested_action,
        status::public.recommendation_status,
        coalesce(meta, '{}'::jsonb)
      from jsonb_to_recordset(${sql.json(chunk)}::jsonb) as x(
        tutor_external_id text,
        tutor_name text,
        team_leader text,
        rule_id text,
        title text,
        description text,
        severity text,
        suggested_action text,
        status text,
        meta jsonb
      )
    `;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let db: ReturnType<typeof postgres> | null = null;
  try {
    if (!DATABASE_URL) return json({ error: "Database connection is not configured" }, 500);

    db = postgres(DATABASE_URL, {
      max: 1,
      prepare: false,
      ssl: "require",
      idle_timeout: 3,
      connect_timeout: 10,
    });

    const auth = await verifyAdmin(req, db);
    if (auth.response) return auth.response;

    // Parse optional filters/context passed from the client for the audit log
    let clientContext: Record<string, unknown> = {};
    try {
      if (req.method === "POST") {
        const bodyText = await req.text();
        if (bodyText) clientContext = JSON.parse(bodyText) ?? {};
      }
    } catch (_e) { /* ignore */ }

    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const cutoff90 = new Date(today.getTime() - 90 * 86400_000).toISOString().slice(0, 10);

    // 1) Tutor universe from action_plan_tutors (roster)
    const tutors = await db<Row[]>`
      select tutor_external_id, tutor_name, team_leader, mentor_name, language, is_mentor
      from public.action_plan_tutors
      order by tutor_name
    `;
    const roster = tutors.filter((t) => !t.is_mentor && t.tutor_external_id);

    // 2) Signals. Direct DB access avoids PostgREST JWT clock-skew failures and has no 1,000-row cap.
    const [quality, leaves, liveIssues, csTickets, engagement, manualRatings, prevScores] = await Promise.all([
      db<Row[]>`
        select tutor_id, agent_name, team_leader, session_date::text as session_date, score
        from public.quality_uploads
        where session_date >= ${cutoff90}::date
      `,
      db<Row[]>`
        select tutor_external_id, leave_date::text as leave_date, leave_reason, source
        from public.tutor_leaves
        where leave_date >= ${cutoff90}::date
      `,
      db<Row[]>`
        select from_tutor_id, session_date::text as session_date, edu_validation
        from public.live_session_issues
        where session_date >= ${cutoff90}::date
          and edu_validation = 'deduct'
      `,
      db<Row[]>`
        select tutor_external_id, ticket_date::text as ticket_date, status, additional_tutors
        from public.cs_tickets
        where ticket_date >= ${cutoff90}::date
          and status = 'Valid'
      `,
      db<Row[]>`
        select tutor_external_id, month::text as month, rating, total_sessions, sessions_with_feedback
        from public.engagement_uploads
        where month >= ${cutoff90}::date
      `,
      db<Row[]>`
        select tutor_external_id, period_month::text as period_month, communication, tl_feedback, parent_handling, culture_fit
        from public.tutor_manual_ratings
        where period_month >= ${cutoff90}::date
      `,
      db<Row[]>`
        select tutor_external_id, snapshot_date::text as snapshot_date, health_score, segment::text as segment
        from public.tutor_segmentation_scores
        order by snapshot_date desc
      `,
    ]);

    // Index prev scores per tutor (most recent before today first, keep list for streaks)
    const prevByTutor = new Map<string, Row>();
    const historyByTutor = new Map<string, Row[]>();
    for (const r of prevScores) {
      if (r.snapshot_date === todayIso) continue;
      if (!prevByTutor.has(r.tutor_external_id)) prevByTutor.set(r.tutor_external_id, r);
      const arr = historyByTutor.get(r.tutor_external_id) ?? [];
      arr.push(r);
      historyByTutor.set(r.tutor_external_id, arr);
    }

    // Emergency leave keywords
    const isEmergency = (reason?: string | null) =>
      !!reason && /emergenc|sick|urgent|no[- ]?show/i.test(String(reason));

    const daysSince = (dateStr?: string | Date | null) => {
      const normalized = dateOnly(dateStr);
      if (!normalized) return 9999;
      const d = new Date(normalized).getTime();
      return Math.max(0, Math.floor((today.getTime() - d) / 86400_000));
    };

    const snapshots: Row[] = [];
    const recommendations: Row[] = [];

    for (const t of roster) {
      const tid = t.tutor_external_id as string;

      // Quality: latest score + avg last-90 (agent_name may map to tutor_name; fallback tutor_id match)
      const qRows = quality.filter(
        (q) => (q.tutor_id && q.tutor_id === tid) || (q.agent_name && q.agent_name === t.tutor_name)
      );
      let quality_score: number | null = null;
      if (qRows.length) {
        // weighted average by recency
        let num = 0, den = 0;
        for (const q of qRows) {
          const w = recencyWeight(daysSince(q.session_date));
          const s = Number(q.score) || 0;
          num += s * w; den += w;
        }
        quality_score = den > 0 ? clamp(num / den) : null;
      }

      // Leaves — per-month averages over 3 months
      const tLeaves = leaves.filter((l) => l.tutor_external_id === tid);
      const plannedCount = tLeaves.filter((l) => !isEmergency(l.leave_reason)).length;
      const emergencyCount = tLeaves.filter((l) => isEmergency(l.leave_reason)).length;
      const plannedPerMonth = plannedCount / 3;
      const emergencyPerMonth = emergencyCount / 3;

      // Map to 0-100 (higher = better)
      const planned_leaves_score = clamp(
        plannedPerMonth <= 1.25 ? 100 : plannedPerMonth <= 2 ? 80 : Math.max(0, 100 - (plannedPerMonth - 1.25) * 30)
      );
      const emergency_leaves_score = clamp(
        emergencyPerMonth === 0 ? 100 : emergencyPerMonth <= 1 ? 80 : emergencyPerMonth <= 2 ? 55 : Math.max(0, 40 - (emergencyPerMonth - 3) * 15)
      );

      // Live issues — recency-weighted count against threshold
      const tIssues = liveIssues.filter((i) => i.from_tutor_id === tid);
      let weightedIssues = 0;
      for (const i of tIssues) weightedIssues += recencyWeight(daysSince(i.session_date));
      const live_issues_score = clamp(
        weightedIssues <= 0.5 ? 100 : weightedIssues <= 2 ? 80 : weightedIssues <= 4 ? 55 : Math.max(0, 40 - (weightedIssues - 5) * 8)
      );

      // CS tickets — pre-filtered to valid; match on primary or additional_tutors, recency-weighted
      const tCs = csTickets.filter((c) => {
        if (c.tutor_external_id === tid) return true;
        const add = c.additional_tutors;
        if (Array.isArray(add)) {
          return add.some((e: any) => e && (e.tutor_external_id === tid || e.tutor_id === tid));
        }
        return false;
      });
      let weightedCs = 0;
      for (const c of tCs) weightedCs += recencyWeight(daysSince(c.ticket_date));
      const cs_tickets_score = clamp(
        weightedCs === 0 ? 100 : weightedCs <= 1 ? 75 : weightedCs <= 2 ? 50 : Math.max(0, 40 - (weightedCs - 3) * 10)
      );

      // Engagement — normalize latest rating (assume /5 -> *20)
      const eRows = engagement.filter((e) => e.tutor_external_id === tid);
      let engagement_score: number | null = null;
      let totalSessions = 0;
      if (eRows.length) {
        let num = 0, den = 0;
        for (const e of eRows) {
          const month = dateOnly(e.month);
          const w = recencyWeight(daysSince(month?.length === 7 ? `${month}-01` : month));
          const raw = Number(e.rating) || 0;
          const norm = raw > 10 ? raw : raw * 20; // supports /5 or /100 storage
          num += norm * w; den += w;
          totalSessions += Number(e.total_sessions) || 0;
        }
        engagement_score = den > 0 ? clamp(num / den) : null;
      }

      // Manual ratings: latest month
      const mRows = manualRatings.filter((m) => m.tutor_external_id === tid).sort((a, b) => (a.period_month < b.period_month ? 1 : -1));
      const latest = mRows[0];
      const to100 = (v: number | null | undefined) => (v == null ? null : clamp(Number(v) * 20));
      const communication_score = to100(latest?.communication);
      const tl_feedback_score = to100(latest?.tl_feedback);
      const parent_handling_score = to100(latest?.parent_handling);
      const culture_fit_score = to100(latest?.culture_fit);

      // Weighted health — skip missing metrics and normalize by used-weight
      const parts: [number | null, number][] = [
        [quality_score, W.quality],
        [planned_leaves_score, W.planned_leaves],
        [emergency_leaves_score, W.emergency_leaves],
        [live_issues_score, W.live_issues],
        [cs_tickets_score, W.cs_tickets],
        [communication_score, W.communication],
        [tl_feedback_score, W.tl_feedback],
        [engagement_score, W.engagement],
        [parent_handling_score, W.parent_handling],
        [culture_fit_score, W.culture_fit],
      ];
      let num = 0, den = 0;
      for (const [v, w] of parts) if (v != null) { num += v * w; den += w; }
      const health_score = den > 0 ? clamp(num / den) : 0;

      // Segment
      let segment: "elite" | "growth" | "at_risk" =
        health_score >= 90 ? "elite" : health_score >= 70 ? "growth" : "at_risk";

      // Hard stops
      const csLast30 = tCs.filter((c) => daysSince(c.ticket_date) <= 30).length;
      const emergLast30 = tLeaves.filter((l) => isEmergency(l.leave_reason) && daysSince(l.leave_date) <= 30).length;
      let hard_stop_reason: string | null = null;
      if (csLast30 >= 2) hard_stop_reason = `${csLast30} valid CS tickets in last 30 days`;
      else if (emergLast30 >= 3) hard_stop_reason = `${emergLast30} emergency leaves in last 30 days`;
      if (hard_stop_reason) segment = "at_risk";

      // Confidence
      const hasQuality = qRows.length >= 2;
      const hasEnough = totalSessions >= 8 || eRows.length >= 2;
      const confidence: "high" | "medium" | "low" =
        hasQuality && hasEnough ? "high" : hasQuality || hasEnough ? "medium" : "low";

      // Trend vs last snapshot
      const prev = prevByTutor.get(tid);
      let trend: "up" | "flat" | "down" = "flat";
      if (prev?.health_score != null) {
        const diff = health_score - Number(prev.health_score);
        trend = diff >= 2 ? "up" : diff <= -2 ? "down" : "flat";
      }

      // Next action
      let next_action = "Monitor";
      if (segment === "at_risk") next_action = "Schedule coaching";
      else if (segment === "growth") next_action = "Monthly follow-up";
      else if (segment === "elite") next_action = "Assign more students";

      snapshots.push({
        tutor_external_id: tid,
        tutor_name: t.tutor_name,
        team_leader: t.team_leader,
        language: t.language,
        snapshot_date: todayIso,
        quality_score,
        planned_leaves_score,
        emergency_leaves_score,
        live_issues_score,
        cs_tickets_score,
        communication_score,
        tl_feedback_score,
        engagement_score,
        parent_handling_score,
        culture_fit_score,
        health_score,
        segment,
        trend,
        confidence,
        hard_stop_reason,
        next_action,
        metrics_meta: {
          leaves: { plannedCount, emergencyCount, plannedPerMonth, emergencyPerMonth },
          live_issues_weighted: weightedIssues,
          cs_valid_weighted: weightedCs,
          quality_samples: qRows.length,
          engagement_samples: eRows.length,
          total_sessions: totalSessions,
        },
      });

      // Recommendations
      const push = (rule_id: string, title: string, severity: "info" | "warning" | "critical", suggested_action: string, description?: string) => {
        recommendations.push({
          tutor_external_id: tid,
          tutor_name: t.tutor_name,
          team_leader: t.team_leader,
          rule_id, title, description: description ?? null,
          severity, suggested_action, status: "open", meta: {},
        });
      };
      if (quality_score != null && quality_score < 85 && qRows.length >= 2) push("quality_low", "Quality below 85", "warning", "Create action plan", `Latest quality avg ${quality_score.toFixed(1)}`);
      if (csLast30 >= 3) push("cs_repeated", "3+ CS tickets in 60 days", "critical", "Flag for TL review");
      if (engagement_score != null && engagement_score < 70) push("engagement_low", "Engagement below 70", "warning", "Observe a live session");
      if (communication_score != null && communication_score < 60) push("communication_low", "Communication low", "warning", "Communication training");
      if (emergLast30 >= 2) push("emergency_leaves_spike", "Emergency leaves spike", "critical", "Schedule coaching");

      // Emergency leaves +50% MoM (last 30d vs 30-60d)
      const emergPrev30 = tLeaves.filter((l) => isEmergency(l.leave_reason) && daysSince(l.leave_date) > 30 && daysSince(l.leave_date) <= 60).length;
      if (emergPrev30 > 0 && emergLast30 >= Math.ceil(emergPrev30 * 1.5) && emergLast30 >= 2) {
        push("emergency_leaves_mom", "Emergency leaves +50% MoM", "warning", "Schedule coaching", `Prev 30d: ${emergPrev30}, last 30d: ${emergLast30}`);
      }

      // Elite for 3 consecutive snapshots
      const hist = historyByTutor.get(tid) ?? [];
      const prev2Elite = hist.slice(0, 2).length === 2 && hist.slice(0, 2).every((h) => (h as any).segment === "elite");
      if (segment === "elite" && prev2Elite) {
        push("elite_streak", "Elite 3 snapshots in a row", "info", "Eligible for mentoring / bonus");
      } else if (segment === "elite") {
        push("elite_ready", "Elite performer", "info", "Assign more students / bonus candidate");
      }
    }

    // Upsert snapshots for today
    if (snapshots.length) await upsertSnapshots(db, snapshots);

    // Refresh recommendations — clear open ones from today's compute, then insert
    const tutorIds = snapshots.map((s) => s.tutor_external_id);
    if (tutorIds.length) {
      await db`
        delete from public.tutor_segmentation_recommendations
        where status = 'open'::public.recommendation_status
          and tutor_external_id in ${db(tutorIds)}
      `;
    }
    if (recommendations.length) await insertRecommendations(db, recommendations);

    // Audit log — record the recompute event
    let actorName: string | null = null;
    try {
      const rows = await db<Row[]>`
        select coalesce(full_name, email) as name from public.profiles where user_id = ${auth.userId} limit 1
      `;
      actorName = rows?.[0]?.name ?? null;
    } catch (_e) { /* ignore */ }

    const auditContext = {
      ...clientContext,
      snapshot_date: todayIso,
      tutors_scored: snapshots.length,
      recommendations_generated: recommendations.length,
      cutoff_date: cutoff90,
    };
    try {
      await db`
        insert into public.tutor_segmentation_audit
          (event_type, actor_id, actor_name, context)
        values ('recompute', ${auth.userId}::uuid, ${actorName}, ${db.json(auditContext)}::jsonb)
      `;
    } catch (e) {
      console.error("audit insert failed", e);
    }

    return json({ ok: true, tutors: snapshots.length, recommendations: recommendations.length, snapshot_date: todayIso });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as any)?.message ?? e) }, 500);
  } finally {
    await db?.end({ timeout: 1 });
  }
});
