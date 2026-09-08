// Canonical iSchool tutor status codes (tutors.status), in display order.
export const TUTOR_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "Working" },
  { value: "1", label: "Training" },
  { value: "2", label: "Resigned" },
  { value: "3", label: "Terminated" },
  { value: "4", label: "Blocked" },
  { value: "5", label: "Withdrawal" },
];

export function tutorStatusLabel(status: number | string | null | undefined): string {
  if (status === null || status === undefined || status === "") return "—";
  const found = TUTOR_STATUS_OPTIONS.find((o) => o.value === String(status));
  return found ? found.label : `Status ${status}`;
}

/** Review cycles are stored as dates in iSchool; show them compactly. */
export function cycleLabel(cycle: string | number | null | undefined): string {
  if (cycle === null || cycle === undefined || cycle === "") return "—";
  const s = String(cycle);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return `Cycle ${s}`;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `Cycle ${d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}
