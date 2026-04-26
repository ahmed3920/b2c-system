import { supabase } from "@/integrations/supabase/client";

export type AnnouncementAudience = "team_leaders" | "mentors" | "both";
export type AnnouncementPriority = "important" | "normal";
export type AnnouncementStatus = "published" | "draft";

export interface Announcement {
  id: string;
  title: string;
  description: string;
  audience: AnnouncementAudience;
  date: string; // ISO date
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
}

// In-memory cache so synchronous getters used by existing components keep working.
let store: Announcement[] = [];
let initialized = false;
let inflight: Promise<void> | null = null;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const mapRow = (r: Record<string, unknown>): Announcement => ({
  id: String(r.id),
  title: String(r.title ?? ""),
  description: String(r.description ?? ""),
  audience: (r.audience as AnnouncementAudience) ?? "both",
  date: String(r.date ?? new Date().toISOString()),
  priority: (r.priority as AnnouncementPriority) ?? "normal",
  status: (r.status as AnnouncementStatus) ?? "published",
});

const fetchAll = async () => {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("date", { ascending: false });
  if (error) {
    console.error("Failed to load announcements", error);
    return;
  }
  store = (data ?? []).map(mapRow);
  initialized = true;
  emit();
};

const ensureLoaded = () => {
  if (initialized || inflight) return inflight;
  inflight = fetchAll().finally(() => {
    inflight = null;
  });
  return inflight;
};

// Realtime: keep cache in sync across tabs/users
if (typeof window !== "undefined") {
  supabase
    .channel("announcements-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "announcements" },
      () => {
        fetchAll();
      },
    )
    .subscribe();
}

export const subscribeAnnouncements = (cb: () => void) => {
  listeners.add(cb);
  ensureLoaded();
  return () => {
    listeners.delete(cb);
  };
};

export const getAnnouncements = (): Announcement[] => {
  ensureLoaded();
  return [...store];
};

export const getPublishedAnnouncements = (): Announcement[] => {
  ensureLoaded();
  return store.filter((a) => a.status === "published");
};

export const addAnnouncement = async (a: Omit<Announcement, "id">) => {
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      title: a.title,
      description: a.description,
      audience: a.audience,
      date: a.date,
      priority: a.priority,
      status: a.status,
    })
    .select()
    .single();
  if (error) {
    console.error("Failed to add announcement", error);
    throw error;
  }
  if (data) {
    store = [mapRow(data), ...store];
    emit();
  }
};

export const updateAnnouncement = async (id: string, patch: Partial<Announcement>) => {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.audience !== undefined) update.audience = patch.audience;
  if (patch.date !== undefined) update.date = patch.date;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.status !== undefined) update.status = patch.status;

  const { data, error } = await supabase
    .from("announcements")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("Failed to update announcement", error);
    throw error;
  }
  if (data) {
    const mapped = mapRow(data);
    store = store.map((x) => (x.id === id ? mapped : x));
    emit();
  }
};

export const removeAnnouncement = async (id: string) => {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete announcement", error);
    throw error;
  }
  store = store.filter((a) => a.id !== id);
  emit();
};

export const audienceLabel = (a: AnnouncementAudience) =>
  a === "team_leaders" ? "Team Leaders" : a === "mentors" ? "Mentors" : "Both";
