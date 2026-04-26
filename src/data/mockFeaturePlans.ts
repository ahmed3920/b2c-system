import { supabase } from "@/integrations/supabase/client";

export type FeatureModule =
  | "Tasks"
  | "Action Plans"
  | "Engagement"
  | "Tracking"
  | "Reports"
  | "User Management"
  | "Announcements"
  | "Other";

export type FeatureStatus = "planned" | "in_progress" | "completed" | "blocked";
export type FeatureVisibility = "team_leaders" | "mentors" | "both" | "hidden";

export interface FeaturePlan {
  id: string;
  name: string;
  description: string;
  module: FeatureModule;
  status: FeatureStatus;
  progress: number; // 0-100
  assignedTo: string;
  targetRelease: string; // ISO date
  visibility: FeatureVisibility;
}

export const FEATURE_MODULES: FeatureModule[] = [
  "Tasks",
  "Action Plans",
  "Engagement",
  "Tracking",
  "Reports",
  "User Management",
  "Announcements",
  "Other",
];

export const statusLabel = (s: FeatureStatus) =>
  s === "planned"
    ? "Planned"
    : s === "in_progress"
    ? "In Progress"
    : s === "completed"
    ? "Completed"
    : "Blocked";

export const visibilityLabel = (v: FeatureVisibility) =>
  v === "team_leaders"
    ? "Team Leaders"
    : v === "mentors"
    ? "Mentors"
    : v === "both"
    ? "Both"
    : "Hidden";

let store: FeaturePlan[] = [];
let initialized = false;
let inflight: Promise<void> | null = null;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const mapRow = (r: Record<string, unknown>): FeaturePlan => ({
  id: String(r.id),
  name: String(r.name ?? ""),
  description: String(r.description ?? ""),
  module: (r.module as FeatureModule) ?? "Other",
  status: (r.status as FeatureStatus) ?? "planned",
  progress: Number(r.progress ?? 0),
  assignedTo: String(r.assigned_to ?? ""),
  targetRelease: String(r.target_release ?? new Date().toISOString()),
  visibility: (r.visibility as FeatureVisibility) ?? "both",
});

const fetchAll = async () => {
  const { data, error } = await supabase
    .from("feature_plans")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load feature plans", error);
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

if (typeof window !== "undefined") {
  supabase
    .channel("feature-plans-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "feature_plans" },
      () => {
        fetchAll();
      },
    )
    .subscribe();
}

export const subscribeFeaturePlans = (cb: () => void) => {
  listeners.add(cb);
  ensureLoaded();
  return () => {
    listeners.delete(cb);
  };
};

export const getFeaturePlans = (): FeaturePlan[] => {
  ensureLoaded();
  return [...store];
};

export const getVisibleFeaturePlans = (): FeaturePlan[] => {
  ensureLoaded();
  return store.filter((f) => f.visibility !== "hidden");
};

const toRow = (f: Partial<FeaturePlan>) => {
  const row: Record<string, unknown> = {};
  if (f.name !== undefined) row.name = f.name;
  if (f.description !== undefined) row.description = f.description;
  if (f.module !== undefined) row.module = f.module;
  if (f.status !== undefined) row.status = f.status;
  if (f.progress !== undefined) row.progress = f.progress;
  if (f.assignedTo !== undefined) row.assigned_to = f.assignedTo;
  if (f.targetRelease !== undefined) row.target_release = f.targetRelease;
  if (f.visibility !== undefined) row.visibility = f.visibility;
  return row;
};

export const addFeaturePlan = async (f: Omit<FeaturePlan, "id">) => {
  const { data, error } = await supabase
    .from("feature_plans")
    .insert(toRow(f) as never)
    .select()
    .single();
  if (error) {
    console.error("Failed to add feature plan", error);
    throw error;
  }
  if (data) {
    store = [mapRow(data), ...store];
    emit();
  }
};

export const updateFeaturePlan = async (id: string, patch: Partial<FeaturePlan>) => {
  const { data, error } = await supabase
    .from("feature_plans")
    .update(toRow(patch))
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("Failed to update feature plan", error);
    throw error;
  }
  if (data) {
    const mapped = mapRow(data);
    store = store.map((x) => (x.id === id ? mapped : x));
    emit();
  }
};

export const removeFeaturePlan = async (id: string) => {
  const { error } = await supabase.from("feature_plans").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete feature plan", error);
    throw error;
  }
  store = store.filter((f) => f.id !== id);
  emit();
};
