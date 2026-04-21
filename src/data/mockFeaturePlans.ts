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

let store: FeaturePlan[] = [
  {
    id: "f1",
    name: "Bulk Task Assignment",
    description:
      "Assign tasks to multiple mentors at once from the Admin dashboard with templates and recurring schedules.",
    module: "Tasks",
    status: "in_progress",
    progress: 65,
    assignedTo: "Product Team",
    targetRelease: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21).toISOString(),
    visibility: "both",
  },
  {
    id: "f2",
    name: "Mentor Engagement Heatmap",
    description:
      "Visual heatmap showing student engagement trends over time, segmented by mentor and subject.",
    module: "Engagement",
    status: "planned",
    progress: 10,
    assignedTo: "Analytics Team",
    targetRelease: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString(),
    visibility: "team_leaders",
  },
  {
    id: "f3",
    name: "Action Plan Templates Library",
    description:
      "A library of pre-built action plan templates that mentors can quickly adopt and customize.",
    module: "Action Plans",
    status: "completed",
    progress: 100,
    assignedTo: "Sarah K.",
    targetRelease: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    visibility: "mentors",
  },
  {
    id: "f4",
    name: "Weekly Performance Reports Export",
    description:
      "Automated PDF export of weekly performance reports delivered via email to Team Leaders.",
    module: "Reports",
    status: "blocked",
    progress: 30,
    assignedTo: "Mohammed R.",
    targetRelease: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(),
    visibility: "both",
  },
  {
    id: "f5",
    name: "Internal QA Dashboard",
    description: "Internal tooling for the QA team — not user-facing.",
    module: "Other",
    status: "in_progress",
    progress: 40,
    assignedTo: "QA Team",
    targetRelease: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    visibility: "hidden",
  },
];

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const subscribeFeaturePlans = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const getFeaturePlans = (): FeaturePlan[] => [...store];

export const getVisibleFeaturePlans = (): FeaturePlan[] =>
  store.filter((f) => f.visibility !== "hidden");

export const addFeaturePlan = (f: Omit<FeaturePlan, "id">) => {
  store = [{ ...f, id: `f-${Date.now()}` }, ...store];
  notify();
};

export const updateFeaturePlan = (id: string, patch: Partial<FeaturePlan>) => {
  store = store.map((f) => (f.id === id ? { ...f, ...patch } : f));
  notify();
};

export const removeFeaturePlan = (id: string) => {
  store = store.filter((f) => f.id !== id);
  notify();
};
