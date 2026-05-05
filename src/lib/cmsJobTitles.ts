import type { CmsRole } from "@/hooks/useCmsRole";

export type CmsJobTitle =
  | "admin"
  | "team_leader"
  | "senior_developer"
  | "developer"
  | "reviewer";

export const JOB_TITLES: { value: CmsJobTitle; label: string; tier: CmsRole }[] = [
  { value: "admin", label: "Admin", tier: "cms_admin" },
  { value: "team_leader", label: "Team Leader", tier: "cms_supervisor" },
  { value: "senior_developer", label: "Senior Developer", tier: "cms_supervisor" },
  { value: "developer", label: "Developer", tier: "cms_member" },
  { value: "reviewer", label: "Reviewer", tier: "cms_member" },
];

export const jobTitleLabel = (t: string | null | undefined): string => {
  if (!t) return "—";
  const m = JOB_TITLES.find((j) => j.value === t);
  return m?.label ?? t;
};

export const tierForTitle = (t: CmsJobTitle): CmsRole =>
  JOB_TITLES.find((j) => j.value === t)?.tier ?? "cms_member";
