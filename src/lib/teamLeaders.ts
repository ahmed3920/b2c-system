export const CANONICAL_TEAM_LEADERS = [
  "Ahmed Hesham Helmy",
  "Anan Mohammed Mohammed Zewil",
  "Ghada Mohamed Ahmed",
  "Nermeen Alhububati",
  "Kareem Abdalwahab Abdalhaleem",
] as const;

export type CanonicalTeamLeader = (typeof CANONICAL_TEAM_LEADERS)[number];

const normalizeKey = (value: string | null | undefined): string =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export function normalizeTeamLeaderName(value: string | null | undefined): CanonicalTeamLeader | null {
  const key = normalizeKey(value);
  if (!key) return null;

  if (key.includes("ahmed") && key.includes("hesham")) return "Ahmed Hesham Helmy";
  if (key.includes("anan")) return "Anan Mohammed Mohammed Zewil";
  if (key.includes("ghada")) return "Ghada Mohamed Ahmed";
  if (key.includes("nermeen") || key.includes("nermin")) return "Nermeen Alhububati";
  if (key.includes("kareem") || key.includes("karim")) return "Kareem Abdalwahab Abdalhaleem";

  return null;
}

export function isCanonicalTeamLeader(value: string | null | undefined): value is CanonicalTeamLeader {
  return CANONICAL_TEAM_LEADERS.includes(value as CanonicalTeamLeader);
}