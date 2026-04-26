import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    // role check
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isAdmin = roleSet.has("admin");
    const isTL = roleSet.has("team_leader");
    if (!isAdmin && !isTL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
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

    // Scope: TLs limited to their team
    let tlFilter: string | null = null;
    if (!isAdmin && isTL) {
      const { data: prof } = await admin
        .from("profiles")
        .select("mentor_name")
        .eq("user_id", userId)
        .maybeSingle();
      tlFilter = prof?.mentor_name ?? null;
      if (!tlFilter) {
        return new Response(JSON.stringify({ error: "Profile missing" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Load modules
    const { data: modules, error: modErr } = await admin
      .from("study_modules")
      .select("id, grade_band, module_code, hours_required, display_order")
      .eq("is_active", true)
      .order("display_order");
    if (modErr) throw modErr;

    // Load occupation (pre)
    let occQ = admin
      .from("tutor_weekly_occupation")
      .select("tutor_external_id, tutor_name, team_leader, free_hours")
      .eq("week_start", weekStart)
      .eq("phase", "pre");
    if (tlFilter) occQ = occQ.eq("team_leader", tlFilter);
    const { data: occupation, error: occErr } = await occQ;
    if (occErr) throw occErr;

    if (!occupation || occupation.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "No pre-week occupation data for this week. Seed sample data or sync the sheet first.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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
      let pubQ = admin
        .from("tutor_published_modules")
        .select("tutor_external_id, module_id, is_finished")
        .eq("week_start", weekStart)
        .eq("phase", "pre")
        .range(pubFrom, pubFrom + PAGE - 1);
      if (tlFilter) pubQ = pubQ.eq("team_leader", tlFilter);
      const { data: pubBatch, error: pubErr } = await pubQ;
      if (pubErr) throw pubErr;
      const batch = pubBatch ?? [];
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
    // The week starts Friday; tutors work Fri→Tue OR Sat→Wed (5 working days).
    // To safely cover both schedules, count leaves Fri (week_start) → Wed (+5).
    const weekStartDate = new Date(weekStart + "T00:00:00Z");
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 5); // Fri + 5 = Wed
    const weekEndStr = weekEndDate.toISOString().slice(0, 10);

    const leavesByTutor = new Map<string, number>();
    {
      const PAGE2 = 1000;
      let from2 = 0;
      while (true) {
        const { data: leaveBatch, error: leaveErr } = await admin
          .from("tutor_leaves")
          .select("tutor_external_id, leave_date")
          .gte("leave_date", weekStart)
          .lte("leave_date", weekEndStr)
          .range(from2, from2 + PAGE2 - 1);
        if (leaveErr) throw leaveErr;
        const batch = leaveBatch ?? [];
        for (const l of batch) {
          leavesByTutor.set(
            l.tutor_external_id,
            (leavesByTutor.get(l.tutor_external_id) ?? 0) + 1,
          );
        }
        if (batch.length < PAGE2) break;
        from2 += PAGE2;
      }
    }
    const HOURS_PER_LEAVE_DAY = 5;

    // Load official holidays inside this working week (Fri → Wed range).
    // Each holiday day deducts 5h from EVERY tutor's free hours.
    const { data: holidayRows, error: holErr } = await admin
      .from("official_holidays")
      .select("holiday_date")
      .gte("holiday_date", weekStart)
      .lte("holiday_date", weekEndStr);
    if (holErr) throw holErr;
    const holidayDays = (holidayRows ?? []).length;

    // Load persistent blocked modules per tutor (e.g. device limitation).
    // These modules are excluded from the candidate set when generating the plan.
    const blockedByTutor = new Map<string, Set<string>>();
    {
      const PAGE3 = 1000;
      let from3 = 0;
      while (true) {
        const { data: blockBatch, error: blockErr } = await admin
          .from("tutor_blocked_modules")
          .select("tutor_external_id, module_id")
          .range(from3, from3 + PAGE3 - 1);
        if (blockErr) throw blockErr;
        const batch = blockBatch ?? [];
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
      // Candidates = catalog modules this tutor has not yet finished
      const candidates = new Set<string>();
      for (const id of allModuleIds) if (!finished.has(id)) candidates.add(id);
      if (candidates.size === 0) {
        skippedAllDone++;
        continue;
      }

      // Subtract 5h per planned-leave day during this working week.
      const leaveDays = leavesByTutor.get(tutor.tutor_external_id) ?? 0;
      const rawFree = Number(tutor.free_hours);
      const adjustedFree = Math.max(
        0,
        (Number.isFinite(rawFree) ? rawFree : 0) - leaveDays * HOURS_PER_LEAVE_DAY,
      );
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
            notes: leaveDays > 0
              ? `Adjusted: original ${rawFree}h − ${leaveDays} leave day${leaveDays > 1 ? "s" : ""} × 5h`
              : null,
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
        tutors_with_leaves: leavesByTutor.size,
        leave_days_total: Array.from(leavesByTutor.values()).reduce((s, v) => s + v, 0),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
