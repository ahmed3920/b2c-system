import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ResolveTimeRow {
  task_id: string;
  title: string;
  priority: string;
  created_at: string;
  updated_at: string;
  resolve_hours: number;
}

export interface ReviewCountRow {
  label: string;
  color: string;
  kind: "category" | "status" | "impact";
  tab: string;
  count: number;
}

export interface AttendanceTrendRow {
  date: string;
  present: number;
  late: number;
  absent: number;
  avg_working_minutes: number;
}

export interface ActivityTrendRow {
  date: string;
  active_minutes: number;
  idle_minutes: number;
  inactive_minutes: number;
}

export interface CmsAnalytics {
  // Tasks
  totalTasks: number;
  byStatus: { name: string; value: number }[];
  byPriority: { name: string; value: number }[];
  resolveTimes: ResolveTimeRow[];
  avgResolveHours: number;
  medianResolveHours: number;
  resolveByPriority: { name: string; avg_hours: number; count: number }[];
  tasksCreatedTrend: { date: string; created: number; done: number }[];
  // Reviews
  reviewRowsTotal: number;
  reviewByTab: { name: string; value: number }[];
  reviewCategories: ReviewCountRow[];
  reviewImpacts: ReviewCountRow[];
  reviewStatuses: ReviewCountRow[];
  // Attendance
  attendanceTrend: AttendanceTrendRow[];
  // Activity
  activityTrend: ActivityTrendRow[];
  // Users
  totalUsers: number;
  activeUsers: number;
}

const EMPTY: CmsAnalytics = {
  totalTasks: 0, byStatus: [], byPriority: [], resolveTimes: [],
  avgResolveHours: 0, medianResolveHours: 0, resolveByPriority: [],
  tasksCreatedTrend: [],
  reviewRowsTotal: 0, reviewByTab: [], reviewCategories: [], reviewImpacts: [], reviewStatuses: [],
  attendanceTrend: [], activityTrend: [],
  totalUsers: 0, activeUsers: 0,
};

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function useCmsAnalytics(daysBack = 30) {
  const [data, setData] = useState<CmsAnalytics>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    const sinceIso = since.toISOString();
    const sinceDate = sinceIso.slice(0, 10);

    const [tasksRes, reviewRowsRes, optionsRes, attRes, actRes, profRes] = await Promise.all([
      supabase.from("cms_tasks").select("id, title, status, priority, created_at, updated_at"),
      supabase.from("cms_task_review_rows" as never).select("id, tab, category_id, status_id, impact_id, created_at"),
      supabase.from("cms_review_options" as never).select("id, label, color, kind, tab"),
      supabase.from("cms_attendance").select("date, status, working_minutes, minutes_late").gte("date", sinceDate),
      supabase.from("cms_user_activity_logs").select("date, status, seconds").gte("date", sinceDate),
      supabase.from("cms_profiles").select("user_id, active_status"),
    ]);

    const tasks = (tasksRes.data ?? []) as any[];
    const reviewRows = (reviewRowsRes.data ?? []) as any[];
    const options = (optionsRes.data ?? []) as any[];
    const attendance = (attRes.data ?? []) as any[];
    const activity = (actRes.data ?? []) as any[];
    const profiles = (profRes.data ?? []) as any[];

    // Tasks status / priority
    const statusMap = new Map<string, number>();
    const priorityMap = new Map<string, number>();
    tasks.forEach((t) => {
      statusMap.set(t.status, (statusMap.get(t.status) ?? 0) + 1);
      priorityMap.set(t.priority, (priorityMap.get(t.priority) ?? 0) + 1);
    });

    // Resolve time (done tasks: updated_at - created_at)
    const doneTasks = tasks.filter((t) => t.status === "done");
    const resolveTimes: ResolveTimeRow[] = doneTasks.map((t) => {
      const ms = new Date(t.updated_at).getTime() - new Date(t.created_at).getTime();
      return {
        task_id: t.id, title: t.title, priority: t.priority,
        created_at: t.created_at, updated_at: t.updated_at,
        resolve_hours: Math.max(0, ms / 3600000),
      };
    }).sort((a, b) => b.resolve_hours - a.resolve_hours);

    const allHours = resolveTimes.map((r) => r.resolve_hours);
    const avg = allHours.length ? allHours.reduce((s, n) => s + n, 0) / allHours.length : 0;
    const med = median(allHours);

    const byPrio = new Map<string, number[]>();
    resolveTimes.forEach((r) => {
      const arr = byPrio.get(r.priority) ?? [];
      arr.push(r.resolve_hours);
      byPrio.set(r.priority, arr);
    });
    const resolveByPriority = Array.from(byPrio.entries()).map(([name, hrs]) => ({
      name, count: hrs.length,
      avg_hours: hrs.reduce((s, n) => s + n, 0) / hrs.length,
    }));

    // Trend: tasks created vs done per day for last N days
    const trendMap = new Map<string, { created: number; done: number }>();
    for (let i = daysBack - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      trendMap.set(d.toISOString().slice(0, 10), { created: 0, done: 0 });
    }
    tasks.forEach((t) => {
      const c = t.created_at?.slice(0, 10);
      if (trendMap.has(c)) trendMap.get(c)!.created += 1;
      if (t.status === "done") {
        const u = t.updated_at?.slice(0, 10);
        if (trendMap.has(u)) trendMap.get(u)!.done += 1;
      }
    });
    const tasksCreatedTrend = Array.from(trendMap.entries()).map(([date, v]) => ({ date, ...v }));

    // Reviews
    const optMap = new Map(options.map((o) => [o.id, o]));
    const tabMap = new Map<string, number>();
    const counter = (key: string, kind: "category" | "status" | "impact") => {
      const m = new Map<string, ReviewCountRow>();
      reviewRows.forEach((r) => {
        const id = r[key];
        if (!id) return;
        const opt = optMap.get(id);
        if (!opt) return;
        const k = opt.id;
        const cur = m.get(k);
        if (cur) cur.count += 1;
        else m.set(k, { label: opt.label, color: opt.color, kind, tab: opt.tab, count: 1 });
      });
      return Array.from(m.values()).sort((a, b) => b.count - a.count);
    };
    reviewRows.forEach((r) => tabMap.set(r.tab, (tabMap.get(r.tab) ?? 0) + 1));

    // Attendance trend
    const attMap = new Map<string, AttendanceTrendRow>();
    for (let i = daysBack - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      attMap.set(k, { date: k, present: 0, late: 0, absent: 0, avg_working_minutes: 0 });
    }
    const wmAcc = new Map<string, { sum: number; n: number }>();
    attendance.forEach((a) => {
      if (!attMap.has(a.date)) return;
      const row = attMap.get(a.date)!;
      if (a.status === "present") row.present += 1;
      else if (a.status === "late") row.late += 1;
      else row.absent += 1;
      if (a.working_minutes != null) {
        const cur = wmAcc.get(a.date) ?? { sum: 0, n: 0 };
        cur.sum += a.working_minutes; cur.n += 1;
        wmAcc.set(a.date, cur);
      }
    });
    wmAcc.forEach((v, k) => {
      const r = attMap.get(k);
      if (r) r.avg_working_minutes = Math.round(v.sum / v.n);
    });

    // Activity trend
    const actMap = new Map<string, ActivityTrendRow>();
    for (let i = daysBack - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      actMap.set(k, { date: k, active_minutes: 0, idle_minutes: 0, inactive_minutes: 0 });
    }
    activity.forEach((l) => {
      if (!actMap.has(l.date)) return;
      const row = actMap.get(l.date)!;
      const mins = Math.round((l.seconds ?? 0) / 60);
      if (l.status === "active") row.active_minutes += mins;
      else if (l.status === "idle") row.idle_minutes += mins;
      else row.inactive_minutes += mins;
    });

    setData({
      totalTasks: tasks.length,
      byStatus: Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })),
      byPriority: Array.from(priorityMap.entries()).map(([name, value]) => ({ name, value })),
      resolveTimes, avgResolveHours: avg, medianResolveHours: med, resolveByPriority,
      tasksCreatedTrend,
      reviewRowsTotal: reviewRows.length,
      reviewByTab: Array.from(tabMap.entries()).map(([name, value]) => ({ name, value })),
      reviewCategories: counter("category_id", "category"),
      reviewImpacts: counter("impact_id", "impact"),
      reviewStatuses: counter("status_id", "status"),
      attendanceTrend: Array.from(attMap.values()),
      activityTrend: Array.from(actMap.values()),
      totalUsers: profiles.length,
      activeUsers: profiles.filter((p) => p.active_status).length,
    });
    setLoading(false);
  }, [daysBack]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, refresh: load };
}
