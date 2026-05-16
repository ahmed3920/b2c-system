import { getMergedMentorForTutor } from "@/data/rosterCache";

/**
 * Returns the assigned mentor for a tutor external id, consulting the merged
 * roster (static data + admin/TL overrides) so changes propagate app-wide.
 */
export function getMentorForTutor(tutorExternalId: string | null | undefined): string {
  return getMergedMentorForTutor(tutorExternalId);
}
