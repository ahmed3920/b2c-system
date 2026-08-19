import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const MUTE_KEY = "notifications:muted";

/** Short two-tone chime generated with the Web Audio API (no asset needed). */
function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.14;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.35);
  });
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  link: string | null;
  read_status: boolean | null;
  created_at: string;
}

/**
 * Subscribes to the current user's notifications and exposes
 * unread count + helpers to mark them read.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [muted, setMutedState] = useState<boolean>(() => {
    try { return localStorage.getItem(MUTE_KEY) === "true"; } catch { return false; }
  });
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Unlock/create the audio context after the first user interaction.
  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      audioCtxRef.current?.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const setMuted = useCallback((value: boolean) => {
    setMutedState(value);
    try { localStorage.setItem(MUTE_KEY, String(value)); } catch { /* ignore */ }
  }, []);

  const notify = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    ctx.resume().then(() => playChime(ctx)).catch(() => {});
  }, []);


  const fetchNotifications = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(30);
    setNotifications((data as AppNotification[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      const uid = session.user.id;
      setUserId(uid);
      await fetchNotifications(uid);

      // Realtime: listen for new notifications inserted for this user
      channel = supabase
        .channel(`notifications-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            const incoming = payload.new as AppNotification;
            setNotifications((prev) => {
              if (prev.some((n) => n.id === incoming.id)) return prev;
              return [incoming, ...prev].slice(0, 30);
            });
            notify();
          },
        )
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_status: true } : n)),
      );
      await supabase.from("notifications").update({ read_status: true }).eq("id", id);
    },
    [],
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read_status: true })));
    await supabase
      .from("notifications")
      .update({ read_status: true })
      .eq("user_id", userId)
      .eq("read_status", false);
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read_status).length;

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead };
}
