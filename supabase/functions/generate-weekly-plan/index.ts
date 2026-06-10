import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface ModuleRow {
  id: string;
  grade_band: string;
  module_code: string;
  hours_required: number;
  display_order: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let db: ReturnType<typeof postgres> | null = null;
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.slice("Bearer ".length);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const dbUrl = Deno.env.get("SUPABASE_DB_URL")?.trim();
    if (!dbUrl) {
      return json({ error: "Database connection is not configured" }, 500);
    }
    db = postgres(dbUrl, {
      max: 1,
      prepare: false,
      ssl: "require",
      idle_timeout: 3,
      connect_timeout: 10,
    });
    const sql = db;

    // Read roles over the direct database connection so authorization is not
    // affected by PostgREST JWT clock-skew errors (PGRST303 "JWT issued at future").
    const callerRoles = await sql<{ role: string }[]>`
      select role::text as role
      from public.user_roles
      where user_id = ${userId}
    `;
    const roleSet = new Set(callerRoles.map((r: { role: string }) => r.role));
    let isAdmin = roleSet.has("admin");
    let isTL = roleSet.has("team_leader") || roleSet.has("super_team_leader");
    if (!isAdmin && !isTL) {
      return json({ error: "Forbidden" }, 403);
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

    // Scope: TLs limited to their team
    let tlFilter: string | null = null;
    if (!isAdmin && isTL) {
      const [prof] = await sql<{ mentor_name: string | null }[]>`
        select mentor_name
        from public.profiles
        where user_id = ${userId}
        limit 1
      `;
      tlFilter = prof?.mentor_name ?? null;
      if (!tlFilter) {
        return json({ error: "Profile missing" }, 400);
      }
    }

    // Load modules
    const modules = await sql<ModuleRow[]>`
      select id, grade_band, module_code, hours_required, display_order
      from public.study_modules
      where is_active = true
      order by display_order
    `;

    // Load occupation (pre)
    const occupation = tlFilter
      ? await sql<any[]>`
          select tutor_external_id, tutor_name, team_leader, free_hours, scheduled_sessions
          from public.tutor_weekly_occupation
          where week_start = ${weekStart}::date
            and phase = 'pre'
            and team_leader = ${tlFilter}
        `
      : await sql<any[]>`
          select tutor_external_id, tutor_name, team_leader, free_hours, scheduled_sessions
          from public.tutor_weekly_occupation
          where week_start = ${weekStart}::date
            and phase = 'pre'
        `;

    if (!occupation || occupation.length === 0) {
      return json(
        {
          error:
            "No pre-week occupation data for this week. Seed sample data or sync the sheet first.",
        },
        400,
      );
    }

    // Load published modules (pre).
    // NOTE: The "StudyFinished" sheet lists only modules a tutor has ALREADY finished.
    // So candidates for this week = every active catalog module NOT in that list.
    // Paginate to bypass PostgREST's default 1000-row cap (this table can have 7k+ rows).
    const PAGE = 1000;
    const published: { tutor_external_id: string; module_id: string; is_finished: boolean }[] = [];
    let pubFrom = 0;
    while (true) {
      const batch = tlFilter
        ? await sql<{ tutor_external_id: string; module_id: string; is_finished: boolean }[]>`
            select tutor_external_id, module_id, is_finished
            from public.tutor_published_modules
            where week_start = ${weekStart}::date
              and phase = 'pre'
              and team_leader = ${tlFilter}
            limit ${PAGE} offset ${pubFrom}
          `
        : await sql<{ tutor_external_id: string; module_id: string; is_finished: boolean }[]>`
            select tutor_external_id, module_id, is_finished
            from public.tutor_published_modules
            where week_start = ${weekStart}::date
              and phase = 'pre'
            limit ${PAGE} offset ${pubFrom}
          `;
      published.push(...batch);
      if (batch.length < PAGE) break;
      pubFrom += PAGE;
    }

    // Finished module-ids per tutor (treat any row as "finished" — that's what the sheet represents)
    // Only tutors that appear in this set are considered "known" — tutors absent from
    // the StudyFinished sheet are skipped (we don't know what they've finished).
    const finishedByTutor = new Map<string, Set<string>>();
    for (const r of published) {
      if (!finishedByTutor.has(r.tutor_external_id))
        finishedByTutor.set(r.tutor_external_id, new Set());
      finishedByTutor.get(r.tutor_external_id)!.add(r.module_id);
    }

    // Load planned leaves overlapping this working week.
    // The week starts Friday; tutors work either Fri→Tue OR Sat→Wed (5 working days).
    // To safely cover both schedules, look at the full Fri (week_start) → Thu (+6) span,
    // then per tutor we filter to only their actual working days (using tutor_weekend_days).
    const weekStartDate = new Date(weekStart + "T00:00:00Z");
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6); // Fri + 6 = Thu (full 7-day span)
    const weekEndStr = weekEndDate.toISOString().slice(0, 10);

    const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayNameOf = (isoDate: string): string => {
      const d = new Date(isoDate + "T00:00:00Z");
      return DAY_NAMES[d.getUTCDay()];
    };

    // Load per-tutor weekend days (lowercase day names like 'thursday', 'friday')
    const weekendByTutor = new Map<string, Set<string>>();
    {
      const PAGE_W = 1000;
      let fromW = 0;
      while (true) {
        const batch = await sql<{ tutor_external_id: string; weekend_days: string[] | null }[]>`
          select tutor_external_id, weekend_days
          from public.tutor_weekend_days
          limit ${PAGE_W} offset ${fromW}
        `;
        for (const r of batch) {
          weekendByTutor.set(
            r.tutor_external_id,
            new Set((r.weekend_days ?? []).map((d: string) => String(d).toLowerCase())),
          );
        }
        if (batch.length < PAGE_W) break;
        fromW += PAGE_W;
      }
    }
    const DEFAULT_WEEKEND = new Set(["wednesday", "thursday"]); // Fri→Tue work week

    // Leaves: store actual dates per tutor so we can later filter by their working days
    const leaveDatesByTutor = new Map<string, string[]>();
    {
      const PAGE2 = 1000;
      let from2 = 0;
      while (true) {
        const batch = await sql<{ tutor_external_id: string; leave_date: string }[]>`
          select tutor_external_id, leave_date::text as leave_date
          from public.tutor_leaves
          where leave_date >= ${weekStart}::date
            and leave_date <= ${weekEndStr}::date
          limit ${PAGE2} offset ${from2}
        `;
        for (const l of batch) {
          const arr = leaveDatesByTutor.get(l.tutor_external_id) ?? [];
          arr.push(l.leave_date);
          leaveDatesByTutor.set(l.tutor_external_id, arr);
        }
        if (batch.length < PAGE2) break;
        from2 += PAGE2;
      }
    }
    const HOURS_PER_LEAVE_DAY = 5;

    // Load official holidays inside the 7-day window. We'll filter per tutor by
    // their actual working days so a Friday holiday doesn't deduct from a tutor
    // whose weekend is Thu/Fri.
    const holidayRows = await sql<{ holiday_date: string }[]>`
      select holiday_date::text as holiday_date
      from public.official_holidays
      where holiday_date >= ${weekStart}::date
        and holiday_date <= ${weekEndStr}::date
    `;
    const holidayDates: string[] = holidayRows.map((r: any) => r.holiday_date);

    // Load persistent blocked modules per tutor (e.g. device limitation).
    // These modules are excluded from the candidate set when generating the plan.
    const blockedByTutor = new Map<string, Set<string>>();
    {
      const PAGE3 = 1000;
      let from3 = 0;
      while (true) {
        const batch = await sql<{ tutor_external_id: string; module_id: string }[]>`
          select tutor_external_id, module_id
          from public.tutor_blocked_modules
          limit ${PAGE3} offset ${from3}
        `;
        for (const b of batch) {
          if (!blockedByTutor.has(b.tutor_external_id))
            blockedByTutor.set(b.tutor_external_id, new Set());
          blockedByTutor.get(b.tutor_external_id)!.add(b.module_id);
        }
        if (batch.length < PAGE3) break;
        from3 += PAGE3;
      }
    }

    const allModuleIds = new Set((modules as ModuleRow[]).map((m) => m.id));
    let skippedNoFinishedData = 0;
    let skippedAllDone = 0;
    let skippedNoHours = 0;

    // sort modules shortest first (then display_order)
    const sortedModules = [...(modules as ModuleRow[])].sort(
      (a, b) =>
        a.hours_required - b.hours_required ||
        a.display_order - b.display_order,
    );

    let plansCreated = 0;
    let itemsCreated = 0;

    // Rebuild plans for the selected week/scope from scratch so tutors that are now
    // fully finished or no longer eligible do not keep stale plans from earlier runs.
    let existingPlansQ = admin
      .from("weekly_study_plans")
      .select("id")
      .eq("week_start", weekStart);
    if (tlFilter) existingPlansQ = existingPlansQ.eq("team_leader", tlFilter);
    const { data: existingPlans, error: existingPlansErr } = await existingPlansQ;
    if (existingPlansErr) throw existingPlansErr;

    const existingPlanIds = (existingPlans ?? []).map((p) => p.id);
    if (existingPlanIds.length > 0) {
      const { error: deleteItemsErr } = await admin
        .from("weekly_study_plan_items")
        .delete()
        .in("plan_id", existingPlanIds);
      if (deleteItemsErr) throw deleteItemsErr;

      let deletePlansQ = admin
        .from("weekly_study_plans")
        .delete()
        .eq("week_start", weekStart);
      if (tlFilter) deletePlansQ = deletePlansQ.eq("team_leader", tlFilter);
      const { error: deletePlansErr } = await deletePlansQ;
      if (deletePlansErr) throw deletePlansErr;
    }

    for (const tutor of occupation) {
      // Skip tutors not present in the StudyFinished sheet — we don't know their progress.
      if (!finishedByTutor.has(tutor.tutor_external_id)) {
        skippedNoFinishedData++;
        continue;
      }
      const finished = finishedByTutor.get(tutor.tutor_external_id)!;
      const blocked = blockedByTutor.get(tutor.tutor_external_id) ?? new Set<string>();
      // Candidates = catalog modules this tutor has not yet finished AND is not blocked from
      const candidates = new Set<string>();
      for (const id of allModuleIds) {
        if (finished.has(id)) continue;
        if (blocked.has(id)) continue;
        candidates.add(id);
      }
      if (candidates.size === 0) {
        skippedAllDone++;
        continue;
      }

      // Determine this tutor's weekend (off) days; default Wed/Thu (Fri→Tue work week).
      const weekend = weekendByTutor.get(tutor.tutor_external_id) ?? DEFAULT_WEEKEND;
      const isWorkingDay = (isoDate: string) => !weekend.has(dayNameOf(isoDate));

      // Count only leave dates and holiday dates that fall on this tutor's working days.
      const tutorLeaveDates = leaveDatesByTutor.get(tutor.tutor_external_id) ?? [];
      const leaveDays = tutorLeaveDates.filter(isWorkingDay).length;
      const holidayDays = holidayDates.filter(isWorkingDay).length;

      const totalDeductionDays = leaveDays + holidayDays;

      // Free hours = 25 − scheduled_sessions (per business rule), then deduct
      // leave/holiday days at 5h each. The session count from the upcoming-sessions
      // sheet already reflects the tutor's actual working days, so no extra
      // weekend-day deduction is needed.
      const sessionCount = Number((tutor as any).scheduled_sessions);
      const baseFree = Math.max(
        0,
        25 - (Number.isFinite(sessionCount) ? sessionCount : 0),
      );
      const adjustedFree = Math.max(
        0,
        baseFree - totalDeductionDays * HOURS_PER_LEAVE_DAY,
      );
      const rawFree = baseFree;
      let remaining = adjustedFree;
      if (!Number.isFinite(remaining) || remaining <= 0) {
        skippedNoHours++;
        continue;
      }

      const items: Array<{
        module_id: string;
        planned_hours: number;
        is_partial: boolean;
        display_order: number;
      }> = [];

      let order = 1;
      for (const m of sortedModules) {
        if (!candidates.has(m.id)) continue;
        if (remaining <= 0) break;
        if (m.hours_required <= remaining) {
          items.push({
            module_id: m.id,
            planned_hours: m.hours_required,
            is_partial: false,
            display_order: order++,
          });
          remaining -= m.hours_required;
        }
      }
      // partial fill if hours left and no more full-fit modules
      if (remaining > 0) {
        for (const m of sortedModules) {
          if (!candidates.has(m.id)) continue;
          if (items.find((i) => i.module_id === m.id)) continue;
          items.push({
            module_id: m.id,
            planned_hours: remaining,
            is_partial: true,
            display_order: order++,
          });
          remaining = 0;
          break;
        }
      }

      const planned = items.reduce((s, i) => s + Number(i.planned_hours), 0);

      // Upsert plan header
      const { data: planRow, error: upErr } = await admin
        .from("weekly_study_plans")
        .upsert(
          {
            tutor_external_id: tutor.tutor_external_id,
            tutor_name: tutor.tutor_name,
            team_leader: tutor.team_leader,
            week_start: weekStart,
            free_hours: adjustedFree,
            notes: (() => {
              const base = `Free = 25 − ${sessionCount} sessions = ${baseFree}h`;
              const parts: string[] = [];
              if (leaveDays > 0) parts.push(`${leaveDays} leave day${leaveDays > 1 ? "s" : ""}`);
              if (holidayDays > 0) parts.push(`${holidayDays} official holiday${holidayDays > 1 ? "s" : ""}`);
              return parts.length > 0
                ? `${base} − (${parts.join(" + ")}) × 5h = ${adjustedFree}h`
                : base;
            })(),
            planned_hours: planned,
            status: "draft",
            generated_by: userId,
          },
          { onConflict: "tutor_external_id,week_start" },
        )
        .select("id")
        .single();
      if (upErr) throw upErr;

      // Replace items
      await admin
        .from("weekly_study_plan_items")
        .delete()
        .eq("plan_id", planRow.id);
      if (items.length > 0) {
        const { error: itErr } = await admin
          .from("weekly_study_plan_items")
          .insert(items.map((i) => ({ ...i, plan_id: planRow.id })));
        if (itErr) throw itErr;
        itemsCreated += items.length;
      }
      plansCreated += 1;
    }

    const { data: weekPlans, error: weekPlansErr } = await admin
      .from("weekly_study_plans")
      .select("id, tutor_external_id")
      .eq("week_start", weekStart);
    if (weekPlansErr) throw weekPlansErr;

    for (const plan of weekPlans ?? []) {
      const finished = finishedByTutor.get(plan.tutor_external_id);
      if (finished && finished.size >= allModuleIds.size) {
        const { error: deletePlanItemsErr } = await admin
          .from("weekly_study_plan_items")
          .delete()
          .eq("plan_id", plan.id);
        if (deletePlanItemsErr) throw deletePlanItemsErr;

        const { error: deletePlanErr } = await admin
          .from("weekly_study_plans")
          .delete()
          .eq("id", plan.id);
        if (deletePlanErr) throw deletePlanErr;

        skippedAllDone++;
        plansCreated = Math.max(0, plansCreated - 1);
      }
    }

    // Compute snapshot totals from the actual saved plans for this week/scope
    let totalsQ = admin
      .from("weekly_study_plans")
      .select("free_hours, planned_hours, tutor_external_id")
      .eq("week_start", weekStart);
    if (tlFilter) totalsQ = totalsQ.eq("team_leader", tlFilter);
    const { data: totalsRows } = await totalsQ;
    const totalFree = (totalsRows ?? []).reduce(
      (s, r: any) => s + Number(r.free_hours ?? 0),
      0,
    );
    const totalPlanned = (totalsRows ?? []).reduce(
      (s, r: any) => s + Number(r.planned_hours ?? 0),
      0,
    );

    // Resolve generator name
    let generatorName: string | null = null;
    const { data: prof } = await admin
      .from("profiles")
      .select("mentor_name, full_name")
      .eq("user_id", userId)
      .maybeSingle();
    generatorName = prof?.full_name ?? prof?.mentor_name ?? null;

    await admin.from("weekly_study_plan_snapshots").insert({
      week_start: weekStart,
      team_leader: tlFilter,
      tutors_count: plansCreated,
      items_count: itemsCreated,
      total_free_hours: totalFree,
      total_planned_hours: totalPlanned,
      generated_by: userId,
      generated_by_name: generatorName,
    });

    return new Response(
      JSON.stringify({
        success: true,
        week_start: weekStart,
        plans_created: plansCreated,
        items_created: itemsCreated,
        tutors_in_occupation: occupation.length,
        tutors_in_finished_sheet: finishedByTutor.size,
        skipped_not_in_finished_sheet: skippedNoFinishedData,
        skipped_all_modules_done: skippedAllDone,
        skipped_no_free_hours: skippedNoHours,
        tutors_with_leaves: leaveDatesByTutor.size,
        leave_days_total: Array.from(leaveDatesByTutor.values()).reduce((s, v) => s + v.length, 0),
        holiday_dates_in_week: holidayDates,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e: any) {
    console.error("generate-weekly-plan error:", e);
    const msg =
      e?.message ||
      e?.error_description ||
      e?.hint ||
      e?.details ||
      (typeof e === "string" ? e : JSON.stringify(e));
    return new Response(
      JSON.stringify({ error: msg, code: e?.code }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
