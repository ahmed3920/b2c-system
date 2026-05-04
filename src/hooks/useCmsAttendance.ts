import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  cairoDateStr,
  nowInCairo,
  minutesOfDay,
  getCheckinWindow,
  ON_TIME_END_MIN,
  type AttendanceStatus,
} from "@/hooks/useTodayAttendance";

export interface CmsAttendanceRow {
  id: string;
  user_id: string;
  user_name: string | null;
  date: string;
  check_in_time: string | null;
  status: AttendanceStatus;
  minutes_late: number;
  late_reason: string | null;
}

export function useCmsAttendance() {
  const [userId, setUserId] = useState<string | null>(null);
  const [row, setRow] = useState<CmsAttendanceRow | null>(null);
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
    const { data } = await supabase
      .from("cms_attendance")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("date", today)
      .maybeSingle();
    setRow((data as CmsAttendanceRow | null) ?? null);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  const checkIn = useCallback(
    async (lateReason?: string) => {
      if (!userId) return { ok: false as const, error: "Not signed in" };
      const cairoNow = nowInCairo();
      const win = getCheckinWindow(cairoNow);
      if (win === "before") return { ok: false as const, error: "Check-in opens at 9:30 AM" };

      const status: AttendanceStatus = win === "open" ? "on_time" : "late";
      const minutes_late = status === "late" ? Math.max(0, minutesOfDay(cairoNow) - ON_TIME_END_MIN) : 0;

      const { data: profile } = await supabase
        .from("cms_profiles")
        .select("full_name")
        .eq("user_id", userId)
        .maybeSingle();

      setSubmitting(true);
      const { data: existing } = await supabase
        .from("cms_attendance")
        .select("id, check_in_time")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      const payload = {
        user_name: profile?.full_name ?? null,
        check_in_time: new Date().toISOString(),
        status,
        minutes_late,
        late_reason: status === "late" ? lateReason?.trim() || null : null,
      };

      let data: CmsAttendanceRow | null = null;
      let error: { message: string } | null = null;

      if (existing?.id) {
        if (existing.check_in_time) {
          setSubmitting(false);
          return { ok: false as const, error: "You've already checked in today." };
        }
        const res = await supabase
          .from("cms_attendance")
          .update(payload)
          .eq("id", existing.id)
          .select("*")
          .maybeSingle();
        data = (res.data as CmsAttendanceRow | null) ?? null;
        error = res.error;
      } else {
        const res = await supabase
          .from("cms_attendance")
          .insert({ user_id: userId, date: today, ...payload })
          .select("*")
          .maybeSingle();
        data = (res.data as CmsAttendanceRow | null) ?? null;
        error = res.error;
      }

      setSubmitting(false);
      if (error) return { ok: false as const, error: error.message };
      setRow(data);
      return { ok: true as const, row: data ?? undefined };
    },
    [userId, today],
  );

  const updateReason = useCallback(
    async (newReason: string) => {
      if (!userId || !row) return { ok: false as const, error: "No check-in to edit" };
      if (row.date !== today) return { ok: false as const, error: "Past records are locked" };
      setSubmitting(true);
      const { data, error } = await supabase
        .from("cms_attendance")
        .update({ late_reason: newReason.trim() || null })
        .eq("id", row.id)
        .select("*")
        .maybeSingle();
      setSubmitting(false);
      if (error) return { ok: false as const, error: error.message };
      setRow((data as CmsAttendanceRow | null) ?? row);
      return { ok: true as const };
    },
    [userId, row, today],
  );

  return { row, loading, submitting, checkIn, updateReason, refresh: load };
}
