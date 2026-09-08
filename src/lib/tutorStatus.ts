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
