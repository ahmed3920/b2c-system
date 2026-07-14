// Compute Tutor Segmentation snapshot.
// - Aggregates per-tutor signals from the last 90 days (recency-weighted)
// - Merges monthly manual ratings
// - Produces a Tutor Health Score, segment, trend, confidence, hard-stop, next action
// - Upserts today's snapshot into tutor_segmentation_scores
// - Regenerates open recommendations in tutor_segmentation_recommendations
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

function recencyWeight(days: number): number {
  if (days <= 30) return 1.0;
  if (days <= 60) return 0.6;
  if (days <= 90) return 0.3;
  return 0;
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

// Fetch all pages
async function fetchAll<T>(supabase: any, build: () => any): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const cutoff90 = new Date(today.getTime() - 90 * 86400_000).toISOString().slice(0, 10);
    const cutoff60 = new Date(today.getTime() - 60 * 86400_000).toISOString().slice(0, 10);
    const cutoff30 = new Date(today.getTime() - 30 * 86400_000).toISOString().slice(0, 10);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

    // 1) Tutor universe from action_plan_tutors (roster)
    const tutors = await fetchAll<Row>(sb, () =>
      sb.from("action_plan_tutors").select("tutor_external_id, tutor_name, team_leader, mentor_name, language, is_mentor")
    );
    const roster = tutors.filter((t) => !t.is_mentor && t.tutor_external_id);

    // 2) Signals
    const [quality, leaves, liveIssues, csTickets, engagement, manualRatings, prevScores] = await Promise.all([
      fetchAll<Row>(sb, () => sb.from("quality_uploads").select("tutor_id, agent_name, team_leader, session_date, score").gte("session_date", cutoff90)),
      fetchAll<Row>(sb, () => sb.from("tutor_leaves").select("tutor_external_id, leave_date, leave_reason, source").gte("leave_date", cutoff90)),
      fetchAll<Row>(sb, () => sb.from("live_session_issues").select("from_tutor_id, session_date, edu_validation").gte("session_date", cutoff90)),
      fetchAll<Row>(sb, () => sb.from("cs_tickets").select("tutor_external_id, ticket_date, mentor_validation, additional_tutors").gte("ticket_date", cutoff90)),
      fetchAll<Row>(sb, () => sb.from("engagement_uploads").select("tutor_external_id, month, rating, total_sessions, sessions_with_feedback").gte("month", cutoff90)),
      fetchAll<Row>(sb, () => sb.from("tutor_manual_ratings").select("tutor_external_id, period_month, communication, tl_feedback, parent_handling, culture_fit").gte("period_month", cutoff90)),
      fetchAll<Row>(sb, () => sb.from("tutor_segmentation_scores").select("tutor_external_id, snapshot_date, health_score").order("snapshot_date", { ascending: false })),
    ]);

    // Index prev scores per tutor (most recent before today)
    const prevByTutor = new Map<string, Row>();
    for (const r of prevScores) {
      if (r.snapshot_date === todayIso) continue;
      if (!prevByTutor.has(r.tutor_external_id)) prevByTutor.set(r.tutor_external_id, r);
    }

    // Emergency leave keywords
    const isEmergency = (reason?: string | null) =>
      !!reason && /emergenc|sick|urgent|no[- ]?show/i.test(String(reason));

    const daysSince = (dateStr?: string | null) => {
      if (!dateStr) return 9999;
      const d = new Date(dateStr).getTime();
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

      // CS tickets — valid tutor-related only, recency-weighted
      const tCs = csTickets.filter((c) => c.tutor_external_id === tid && c.mentor_validation === "valid");
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
          const w = recencyWeight(daysSince(e.month + "-01"));
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
          severity, suggested_action, status: "open",
        });
      };
      if (quality_score != null && quality_score < 85 && qRows.length >= 2) push("quality_low", "Quality below 85", "warning", "Create action plan", `Latest quality avg ${quality_score.toFixed(1)}`);
      if (csLast30 >= 3) push("cs_repeated", "3+ CS tickets in 60 days", "critical", "Flag for TL review");
      if (engagement_score != null && engagement_score < 70) push("engagement_low", "Engagement below 70", "warning", "Observe a live session");
      if (communication_score != null && communication_score < 60) push("communication_low", "Communication low", "warning", "Communication training");
      if (emergLast30 >= 2) push("emergency_leaves_spike", "Emergency leaves spike", "critical", "Schedule coaching");
      if (segment === "elite") push("elite_ready", "Elite performer", "info", "Assign more students / bonus candidate");
    }

    // Upsert snapshots for today
    if (snapshots.length) {
      // Chunk to be safe
      for (let i = 0; i < snapshots.length; i += 500) {
        const chunk = snapshots.slice(i, i + 500);
        const { error } = await sb.from("tutor_segmentation_scores").upsert(chunk, { onConflict: "tutor_external_id,snapshot_date" });
        if (error) throw error;
      }
    }

    // Refresh recommendations — clear open ones from today's compute, then insert
    const tutorIds = snapshots.map((s) => s.tutor_external_id);
    if (tutorIds.length) {
      await sb.from("tutor_segmentation_recommendations")
        .delete()
        .eq("status", "open")
        .in("tutor_external_id", tutorIds);
    }
    if (recommendations.length) {
      for (let i = 0; i < recommendations.length; i += 500) {
        const chunk = recommendations.slice(i, i + 500);
        const { error } = await sb.from("tutor_segmentation_recommendations").insert(chunk);
        if (error) throw error;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, tutors: snapshots.length, recommendations: recommendations.length, snapshot_date: todayIso }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
