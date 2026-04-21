import { tutorRoster } from "@/data/tutorRoster";

// Build a one-time lookup of tutor external id -> assigned mentor name.
const mentorById = new Map<string, string>();
for (const t of tutorRoster) {
  if (t.id && t.mentor) mentorById.set(t.id.trim().toUpperCase(), t.mentor);
}

export function getMentorForTutor(tutorExternalId: string | null | undefined): string {
  if (!tutorExternalId) return "—";
  return mentorById.get(tutorExternalId.trim().toUpperCase()) ?? "—";
}
