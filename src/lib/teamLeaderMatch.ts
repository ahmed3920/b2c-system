import { normalizeTeamLeaderName } from "./teamLeaders";

/**
 * Names of team leaders may differ between the auth profile (`mentor_name`)
 * and the tutor roster (`team_leader`) — e.g. "Ahmed Hesham" vs
 * "Ahmed Hesham  Helmy". We normalize whitespace/case and require all tokens
 * of the shorter name to appear in the longer one.
 */
export function normalizeName(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function teamLeaderMatches(
  candidate: string | null | undefined,
  myName: string | null | undefined,
): boolean {
  const canonicalCandidate = normalizeTeamLeaderName(candidate);
  const canonicalMine = normalizeTeamLeaderName(myName);
  if (canonicalCandidate && canonicalMine) return canonicalCandidate === canonicalMine;

  const a = normalizeName(candidate);
  const b = normalizeName(myName);
  if (!a || !b) return false;
  if (a === b) return true;
  const at = a.split(" ");
  const bt = b.split(" ");
  const [shortT, longT] = at.length <= bt.length ? [at, bt] : [bt, at];
  return shortT.every((tok) => longT.includes(tok));
}
