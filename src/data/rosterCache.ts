// Module-level cache that merges the static tutor roster with DB overrides
// from the `tutor_roster_overrides` table. All synchronous lookups across the
// app (mentor/TL lookups, team summaries, profile pages) read from here so
// admin/TL overrides apply globally without changing every call site.

import { supabase } from "@/integrations/supabase/client";
import { tutorRoster, type TutorRecord } from "./tutorRoster";

export interface RosterOverrideRow {
  tutor_external_id: string;
  name: string | null;
  team_leader: string | null;
  mentor: string | null;
  ranking: string | null;
  phone: string | null;
  role: string | null;
  language: string | null;
  employment_type: string | null;
  is_new: boolean | null;
}

// Collapse internal whitespace and trim so variants like "Ahmed Hesham  Helmy"
// (double space) and "Ahmed Hesham Helmy" (single space) are treated as the
// same canonical team-leader / mentor name across the whole app. Without this,
// every list/filter that groups by `team_leader` shows the same person twice.
function canon(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

const normalizedStatic: TutorRecord[] = tutorRoster.map((t) => ({
  ...t,
  team_leader: canon(t.team_leader),
  mentor: canon(t.mentor),
  name: canon(t.name),
}));

let overrides: RosterOverrideRow[] = [];
let cached: TutorRecord[] = [...normalizedStatic];
let cachedById = new Map<string, TutorRecord>(normalizedStatic.map((t) => [t.id, t]));
let mentorById = new Map<string, string>();
for (const t of normalizedStatic) {
  if (t.id && t.mentor) mentorById.set(t.id.trim().toUpperCase(), t.mentor);
}

const listeners = new Set<() => void>();
let bootstrapped = false;

function rebuild() {
  const byId = new Map<string, TutorRecord>();
  for (const t of normalizedStatic) byId.set(t.id, { ...t });
  for (const o of overrides) {
    const existing = byId.get(o.tutor_external_id);
    if (existing) {
      byId.set(o.tutor_external_id, {
        ...existing,
        name: canon(o.name) || existing.name,
        team_leader: canon(o.team_leader ?? existing.team_leader),
        mentor: canon(o.mentor ?? existing.mentor),
        ranking: o.ranking ?? existing.ranking,
        phone: o.phone ?? existing.phone,
        role: (o.role ?? existing.role) as TutorRecord["role"],
        language: o.language ?? existing.language,
        employment_type: (o.employment_type ?? existing.employment_type) as TutorRecord["employment_type"],
      });
    } else {
      byId.set(o.tutor_external_id, {
        id: o.tutor_external_id,
        name: canon(o.name) || o.tutor_external_id,
        team_leader: canon(o.team_leader),
        mentor: canon(o.mentor),
        ranking: o.ranking ?? "",
        phone: o.phone ?? "",
        role: (o.role ?? "Tutor") as TutorRecord["role"],
        language: o.language ?? "",
        employment_type: (o.employment_type ?? "Full-time") as TutorRecord["employment_type"],
      });
    }
  }
  cached = Array.from(byId.values());
  cachedById = byId;
  const m = new Map<string, string>();
  for (const t of cached) {
    if (t.id && t.mentor) m.set(t.id.trim().toUpperCase(), t.mentor);
  }
  mentorById = m;
  for (const l of listeners) l();
}

export function setRosterOverrides(rows: RosterOverrideRow[]) {
  overrides = rows ?? [];
  rebuild();
}

export function subscribeRoster(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getMergedRoster(): TutorRecord[] {
  return cached;
}

export function getMergedTutorById(id: string | null | undefined): TutorRecord | undefined {
  if (!id) return undefined;
  return cachedById.get(id);
}

export function getMergedMentorForTutor(id: string | null | undefined): string {
  if (!id) return "—";
  return mentorById.get(id.trim().toUpperCase()) ?? "—";
}

export async function refreshRosterCache() {
  const { data } = await supabase.from("tutor_roster_overrides").select("*");
  if (data) setRosterOverrides(data as RosterOverrideRow[]);
}

export async function bootstrapRosterCache() {
  if (bootstrapped) return;
  bootstrapped = true;
  try {
    await refreshRosterCache();
  } catch {
    // ignore — cache stays on static roster
  }
  try {
    supabase
      .channel("tutor_roster_overrides_global")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tutor_roster_overrides" },
        async () => {
          await refreshRosterCache();
        },
      )
      .subscribe();
  } catch {
    // ignore
  }
}
