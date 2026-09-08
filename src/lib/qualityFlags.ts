/** Quality review flags: flag_type 1 = Yellow, 2 = Red (anything else = Other). */

export type FlagLevel = "red" | "yellow" | "none";

export const FLAG_FILTER_OPTIONS = [
  { value: "red", label: "Red flag" },
  { value: "yellow", label: "Yellow flag" },
  { value: "any", label: "Any flag" },
  { value: "none", label: "No flags" },
] as const;

export function flagTypeLabel(type: number | string | null | undefined) {
  const n = Number(type);
  if (n === 2) return "Red";
  if (n === 1) return "Yellow";
  return "Other";
}

export function flagLevelLabel(level: string | null | undefined) {
  if (level === "red") return "Red";
  if (level === "yellow") return "Yellow";
  return "None";
}

/** Tailwind classes for a flag badge, using semantic tokens. */
export function flagBadgeClass(level: string | null | undefined) {
  if (level === "red") return "bg-destructive text-destructive-foreground hover:bg-destructive/90";
  if (level === "yellow") return "bg-warning text-warning-foreground hover:bg-warning/90";
  return "";
}

/** Score out of 5 -> percentage string, e.g. 4.5 -> "90.0%". */
export function scorePct(score: string | number | null | undefined, digits = 1) {
  if (score === null || score === undefined || score === "") return "—";
  const n = Number(score);
  if (!Number.isFinite(n)) return "—";
  return `${((n / 5) * 100).toFixed(digits)}%`;
}
