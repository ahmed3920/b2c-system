import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cairoDateStr } from "@/hooks/useTodayAttendance";
import type { ActivityStatus } from "./useCmsActivityTracker";

export interface UserActivitySummary {
  user_id: string;
  full_name: string | null;
  email: string | null;
  active_minutes: number;
  idle_minutes: number;
  inactive_minutes: number;
  last_seen_at: string | null;
  current_status: ActivityStatus | "offline";
  check_in_time: string | null;
  check_out_time: string | null;
  working_minutes: number | null;
}

const STALE_MS = 3 * 60 * 1000; // no heartbeat in 3 min => consider offline/inactive

interface LogRow {
  user_id: string;
  status: ActivityStatus;
  seconds: number;
  updated_at: string;
  bucket_start: string;
}

export function useCmsActivitySummary() {
  const [rows, setRows] = useState<UserActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const today = cairoDateStr();

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profiles }, { data: logs }, { data: attendance }] = await Promise.all([
      supabase.from("cms_profiles").select("user_id, full_name, email, active_status"),
      supabase
        .from("cms_user_activity_logs")
        .select("user_id, status, seconds, updated_at, bucket_start")
        .eq("date", today),
      supabase
        .from("cms_attendance")
        .select("user_id, check_in_time, check_out_time, working_minutes")
        .eq("date", today),
    ]);

    const profMap = new Map<string, { full_name: string | null; email: string | null }>();
    (profiles ?? []).forEach((p: any) => {
      if (p.active_status === false) return;
      profMap.set(p.user_id, { full_name: p.full_name, email: p.email });
    });

    const attMap = new Map<string, { check_in_time: string | null; check_out_time: string | null; working_minutes: number | null }>();
    (attendance ?? []).forEach((a: any) => attMap.set(a.user_id, a));

    const byUser = new Map<string, { active: number; idle: number; inactive: number; last: string | null }>();
    (logs ?? []).forEach((l: LogRow) => {
      const cur = byUser.get(l.user_id) ?? { active: 0, idle: 0, inactive: 0, last: null };
      if (l.status === "active") cur.active += l.seconds;
      else if (l.status === "idle") cur.idle += l.seconds;
      else cur.inactive += l.seconds;
      if (!cur.last || l.updated_at > cur.last) cur.last = l.updated_at;
      byUser.set(l.user_id, cur);
    });

    const now = Date.now();
    const summaries: UserActivitySummary[] = [];
    profMap.forEach((p, user_id) => {
      const stats = byUser.get(user_id);
      const att = attMap.get(user_id);
      const lastTs = stats?.last ? new Date(stats.last).getTime() : 0;
      const stale = !lastTs || now - lastTs > STALE_MS;
      let current: UserActivitySummary["current_status"] = "offline";
      if (!stale && stats) {
        // We don't store live status separately; infer from last bucket time.
        const ageMin = (now - lastTs) / 60000;
        if (ageMin > 15) current = "inactive";
        else if (ageMin > 5) current = "idle";
        else current = "active";
      }
      summaries.push({
        user_id,
        full_name: p.full_name,
        email: p.email,
        active_minutes: Math.round((stats?.active ?? 0) / 60),
        idle_minutes: Math.round((stats?.idle ?? 0) / 60),
        inactive_minutes: Math.round((stats?.inactive ?? 0) / 60),
        last_seen_at: stats?.last ?? null,
        current_status: current,
        check_in_time: att?.check_in_time ?? null,
        check_out_time: att?.check_out_time ?? null,
        working_minutes: att?.working_minutes ?? null,
      });
    });

    summaries.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    setRows(summaries);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 30000);
    return () => window.clearInterval(t);
  }, [load]);

  return { rows, loading, refresh: load };
}
