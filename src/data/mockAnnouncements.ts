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

const STORAGE_KEY = "ischool_announcements_v1";

const seed: Announcement[] = [
  {
    id: "a1",
    title: "Q2 Performance Review Window Open",
    description:
      "The Q2 performance review window is now open. Team Leaders please complete all mentor reviews by the end of the month to ensure timely feedback and goal-setting for the next quarter.",
    audience: "team_leaders",
    date: new Date().toISOString(),
    priority: "important",
    status: "published",
  },
  {
    id: "a2",
    title: "New Session Logging Guidelines",
    description:
      "Please review the updated session logging guidelines available in the knowledge base. All mentors are required to log session notes within 24 hours of each session.",
    audience: "mentors",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    priority: "normal",
    status: "published",
  },
  {
    id: "a3",
    title: "Platform Maintenance Window — Friday 10pm",
    description:
      "Scheduled maintenance on Friday from 10pm to 11pm. The platform may be briefly unavailable during this window. Please plan your sessions accordingly.",
    audience: "both",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    priority: "important",
    status: "published",
  },
  {
    id: "a4",
    title: "Monthly All-Hands Recording Available",
    description:
      "The recording from this month's all-hands meeting is now available in the shared drive. Highlights include the new growth roadmap and updates from the product team.",
    audience: "both",
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    priority: "normal",
    status: "published",
  },
];

const cloneSeed = (): Announcement[] => seed.map((item) => ({ ...item }));

const readStoredAnnouncements = (): Announcement[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Announcement[]) : null;
  } catch {
    return null;
  }
};

let store: Announcement[] = cloneSeed();

const persist = (nextStore: Announcement[] = store) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
  } catch {
    /* ignore storage write errors */
  }
};

const syncStoreFromStorage = () => {
  const stored = readStoredAnnouncements();
  if (stored) {
    store = stored;
    return;
  }

  store = cloneSeed();
  persist(store);
};

syncStoreFromStorage();

const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((l) => l());
};

const handleStorageChange = (event: StorageEvent) => {
  if (event.key !== STORAGE_KEY) return;
  syncStoreFromStorage();
  emit();
};

const notify = () => {
  persist();
  emit();
};

export const subscribeAnnouncements = (cb: () => void) => {
  listeners.add(cb);

  if (typeof window !== "undefined" && listeners.size === 1) {
    window.addEventListener("storage", handleStorageChange);
  }

  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined" && listeners.size === 0) {
      window.removeEventListener("storage", handleStorageChange);
    }
  };
};

export const getAnnouncements = (): Announcement[] => {
  syncStoreFromStorage();
  return [...store];
};

export const getPublishedAnnouncements = (): Announcement[] => {
  syncStoreFromStorage();
  return store.filter((a) => a.status === "published");
};

export const addAnnouncement = (a: Omit<Announcement, "id">) => {
  store = [{ ...a, id: `a-${Date.now()}` }, ...store];
  notify();
};

export const updateAnnouncement = (id: string, patch: Partial<Announcement>) => {
  store = store.map((a) => (a.id === id ? { ...a, ...patch } : a));
  notify();
};

export const removeAnnouncement = (id: string) => {
  store = store.filter((a) => a.id !== id);
  notify();
};

export const audienceLabel = (a: AnnouncementAudience) =>
  a === "team_leaders" ? "Team Leaders" : a === "mentors" ? "Mentors" : "Both";
