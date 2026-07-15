import { type TutorRecord } from "./tutorRoster";
import { getMergedRoster, getMergedTutorById } from "./rosterCache";

export function teamSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export interface TeamSummary {
  slug: string;
  team_leader: string;
  total: number;
  tutors: number;
  mentors: number;
  arabic: number;
  english: number;
  full_time: number;
  part_time: number;
  contract: number;
  members: TutorRecord[];
}

export function getTeamSummaries(excludeIds?: Set<string>): TeamSummary[] {
  const map = new Map<string, TutorRecord[]>();
  for (const t of getMergedRoster()) {
    if (!t.team_leader) continue;
    if (excludeIds && excludeIds.has(t.id)) continue;
    const arr = map.get(t.team_leader) ?? [];
    arr.push(t);
    map.set(t.team_leader, arr);
  }
  return Array.from(map.entries())
    .map(([team_leader, members]) => ({
      slug: teamSlug(team_leader),
      team_leader,
      total: members.length,
      tutors: members.filter((m) => m.role === "Tutor").length,
      mentors: members.filter((m) => m.role === "Mentor").length,
      arabic: members.filter((m) => m.language === "Arabic").length,
      english: members.filter((m) => m.language === "English").length,
      full_time: members.filter((m) => m.employment_type === "Full-time").length,
      part_time: members.filter((m) => m.employment_type === "Part-time").length,
      contract: members.filter((m) => m.employment_type === "Contract").length,
      members,
    }))
    .sort((a, b) => b.total - a.total);
}

export function getTeamBySlug(slug: string, excludeIds?: Set<string>): TeamSummary | undefined {
  return getTeamSummaries(excludeIds).find((t) => t.slug === slug);
}

export function getTutorById(id: string): TutorRecord | undefined {
  return getMergedTutorById(id);
}
