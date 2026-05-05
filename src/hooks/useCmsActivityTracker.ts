import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cairoDateStr } from "@/hooks/useTodayAttendance";

export type ActivityStatus = "active" | "idle" | "inactive";

const IDLE_AFTER_MS = 5 * 60 * 1000; // 5 min
const INACTIVE_AFTER_MS = 15 * 60 * 1000; // 15 min
const HEARTBEAT_MS = 60 * 1000; // 60s
const BUCKET_MS = 60 * 1000; // 1-min buckets

function statusFor(lastActiveAt: number, now: number): ActivityStatus {
  const diff = now - lastActiveAt;
  if (diff >= INACTIVE_AFTER_MS) return "inactive";
  if (diff >= IDLE_AFTER_MS) return "idle";
  return "active";
}

function bucketStart(d: Date): string {
  const ms = d.getTime();
  return new Date(ms - (ms % BUCKET_MS)).toISOString();
}

/**
 * Tracks user activity (mouse, keyboard, scroll, touch) and writes 1-minute
 * heartbeat rows to cms_user_activity_logs while the user is signed into the CMS.
 */
export function useCmsActivityTracker(enabled: boolean) {
  const lastActiveRef = useRef<number>(Date.now());
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      userIdRef.current = session?.user.id ?? null;
    });

    const markActive = () => {
      lastActiveRef.current = Date.now();
    };

    const events: (keyof DocumentEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "wheel",
    ];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    const onVisibility = () => {
      if (document.visibilityState === "visible") markActive();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const sendHeartbeat = async () => {
      const userId = userIdRef.current;
      if (!userId || cancelled) return;
      const now = new Date();
      const status = statusFor(lastActiveRef.current, now.getTime());
      const bucket = bucketStart(now);
      const date = cairoDateStr(now);

      try {
        // Try update first, then insert if no row exists.
        const { data: updated, error: updErr } = await supabase
          .from("cms_user_activity_logs")
          .update({ seconds: 60, updated_at: now.toISOString() })
          .eq("user_id", userId)
          .eq("bucket_start", bucket)
          .eq("status", status)
          .select("id")
          .maybeSingle();
        if (updErr) {
          // ignore
        }
        if (!updated) {
          await supabase.from("cms_user_activity_logs").insert({
            user_id: userId,
            date,
            bucket_start: bucket,
            status,
            seconds: 60,
          });
        }
      } catch {
        // network errors silently ignored
      }
    };

    // Send one immediately so the user appears online
    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, HEARTBEAT_MS);

    const onUnload = () => {
      // Best-effort flush
      sendHeartbeat();
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      cancelled = true;
      events.forEach((e) => window.removeEventListener(e, markActive));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      window.clearInterval(interval);
    };
  }, [enabled]);
}
