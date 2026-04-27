import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AttendanceStatus = "on_time" | "late" | "absent";

export interface AttendanceRow {
  id: string;
  team_leader_id: string;
  team_leader_name: string | null;
  date: string;
  check_in_time: string | null;
  status: AttendanceStatus;
  minutes_late: number;
  late_reason: string | null;
}

/** Africa/Cairo (UTC+2, no DST) — matches the DB CHECK in RLS. */
export function nowInCairo(): Date {
  // Convert local now to Cairo by formatting parts then re-building.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const y = get("year");
  const mo = get("month");
  const d = get("day");
  const h = get("hour");
  const mi = get("minute");
  const s = get("second");
  // Construct as "local" but the components reflect Cairo wall clock.
  return new Date(y, mo - 1, d, h, mi, s);
}

export function cairoDateStr(d: Date = nowInCairo()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns minutes since midnight in Cairo for a given Cairo-wall-clock Date. */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export const CHECKIN_OPEN_MIN = 9 * 60 + 30; // 09:30
export const ON_TIME_END_MIN = 10 * 60 + 15; // 10:15

export type CheckinWindow = "before" | "open" | "late";
export function getCheckinWindow(d: Date = nowInCairo()): CheckinWindow {
  const m = minutesOfDay(d);
  if (m < CHECKIN_OPEN_MIN) return "before";
  if (m <= ON_TIME_END_MIN) return "open";
  return "late";
}

export function useTodayAttendance() {
  const [userId, setUserId] = useState<string | null>(null);
  const [row, setRow] = useState<AttendanceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const today = cairoDateStr();

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setUserId(null);
      setRow(null);
      setLoading(false);
      return;
    }
    setUserId(session.user.id);
    const { data, error } = await supabase
      .from("team_leader_attendance")
      .select("*")
      .eq("team_leader_id", session.user.id)
      .eq("date", today)
      .maybeSingle();
    if (!error) setRow((data as AttendanceRow | null) ?? null);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const checkIn = useCallback(
    async (lateReason?: string): Promise<{ ok: boolean; error?: string; row?: AttendanceRow }> => {
      if (!userId) return { ok: false, error: "Not signed in" };
      const cairoNow = nowInCairo();
      const window = getCheckinWindow(cairoNow);
      if (window === "before") return { ok: false, error: "Check-in opens at 9:30 AM" };

      const status: AttendanceStatus = window === "open" ? "on_time" : "late";
      const minutes_late =
        status === "late" ? Math.max(0, minutesOfDay(cairoNow) - ON_TIME_END_MIN) : 0;

      // Get user display name for the row
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, mentor_name")
        .eq("user_id", userId)
        .maybeSingle();

      setSubmitting(true);

      // A row may already exist for today (e.g. auto-created "absent" by the daily job).
      // Check first, then UPDATE or INSERT accordingly to avoid the unique-day collision.
      const { data: existing } = await supabase
        .from("team_leader_attendance")
        .select("id, check_in_time")
        .eq("team_leader_id", userId)
        .eq("date", today)
        .maybeSingle();

      const payload = {
        team_leader_name: profile?.full_name ?? profile?.mentor_name ?? null,
        check_in_time: new Date().toISOString(),
        status,
        minutes_late,
        late_reason: status === "late" ? (lateReason?.trim() || null) : null,
      };

      let data: AttendanceRow | null = null;
      let error: { message: string } | null = null;

      if (existing?.id) {
        if (existing.check_in_time) {
          setSubmitting(false);
          return { ok: false, error: "You've already checked in today." };
        }
        const res = await supabase
          .from("team_leader_attendance")
          .update(payload)
          .eq("id", existing.id)
          .select("*")
          .maybeSingle();
        data = (res.data as AttendanceRow | null) ?? null;
        error = res.error;
      } else {
        const res = await supabase
          .from("team_leader_attendance")
          .insert({
            team_leader_id: userId,
            date: today,
            ...payload,
          })
          .select("*")
          .maybeSingle();
        data = (res.data as AttendanceRow | null) ?? null;
        error = res.error;
      }

      setSubmitting(false);

      if (error) return { ok: false, error: error.message };
      setRow(data);
      return { ok: true, row: data ?? undefined };
    },
    [userId, today],
  );

  const updateReason = useCallback(
    async (newReason: string): Promise<{ ok: boolean; error?: string }> => {
      if (!userId || !row) return { ok: false, error: "No check-in to edit" };
      if (row.date !== today) return { ok: false, error: "Past records are locked" };
      setSubmitting(true);
      const { data, error } = await supabase
        .from("team_leader_attendance")
        .update({ late_reason: newReason.trim() || null })
        .eq("id", row.id)
        .select("*")
        .maybeSingle();
      setSubmitting(false);
      if (error) return { ok: false, error: error.message };
      setRow((data as AttendanceRow | null) ?? row);
      return { ok: true };
    },
    [userId, row, today],
  );

  return { row, loading, submitting, checkIn, updateReason, refresh: load };
}
