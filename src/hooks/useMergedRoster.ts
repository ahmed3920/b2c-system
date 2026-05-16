import { useSyncExternalStore } from "react";
import { getMergedRoster, subscribeRoster } from "@/data/rosterCache";
import type { TutorRecord } from "@/data/tutorRoster";

/**
 * Live merged roster (static data + admin/TL overrides). Components
 * subscribing to this re-render automatically when overrides change.
 */
export function useMergedRoster(): TutorRecord[] {
  return useSyncExternalStore(subscribeRoster, getMergedRoster, getMergedRoster);
}
