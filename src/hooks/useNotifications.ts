import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isSoundMuted,
  playNotificationSound,
  primeNotificationSound,
  setSoundMuted,
} from "@/lib/notificationSound";


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
  const [soundMuted, setSoundMutedState] = useState(() => isSoundMuted());

  const toggleSound = useCallback(() => {
    setSoundMutedState((prev) => {
      const next = !prev;
      setSoundMuted(next);
      return next;
    });
  }, []);

  useEffect(() => {
    primeNotificationSound();
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
            playNotificationSound();
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
