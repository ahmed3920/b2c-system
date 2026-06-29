import { useMemo } from "react";
import { ExportDialog, type ExportColumn } from "@/components/exports/ExportDialog";

export interface EngagementExportRow {
  tutor_external_id: string | null;
  tutor_name: string;
  is_mentor: boolean | null;
  tutor_language: string | null;
  availability_type: string | null;
  team_leader: string;
  month: string;
  total_sessions: number | null;
  sessions_with_feedback: number | null;
  rating: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: EngagementExportRow[];
}

export function EngagementExportDialog({ open, onOpenChange, rows }: Props) {
  const teamLeaders = useMemo(
    () => Array.from(new Set(rows.map((r) => r.team_leader).filter(Boolean))).sort(),
    [rows],
  );
  const languages = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.tutor_language).filter((v): v is string => !!v)),
      ).sort(),
    [rows],
  );
  const months = useMemo(
    () => Array.from(new Set(rows.map((r) => r.month))).sort(),
    [rows],
  );

  const columns: ExportColumn<EngagementExportRow>[] = [
    { key: "month", label: "Month", accessor: (r) => r.month },
    { key: "tutor_external_id", label: "Tutor ID", accessor: (r) => r.tutor_external_id ?? "" },
    { key: "tutor_name", label: "Tutor Name", accessor: (r) => r.tutor_name },
    { key: "is_mentor", label: "Is Mentor", accessor: (r) => (r.is_mentor ? "Mentor" : "Tutor") },
    { key: "tutor_language", label: "Language", accessor: (r) => r.tutor_language ?? "" },
    { key: "availability_type", label: "Availability", accessor: (r) => r.availability_type ?? "" },
    { key: "team_leader", label: "Team Leader", accessor: (r) => r.team_leader },
    { key: "total_sessions", label: "Total Sessions", accessor: (r) => r.total_sessions ?? 0 },
    { key: "sessions_with_feedback", label: "Sessions With Feedback", accessor: (r) => r.sessions_with_feedback ?? 0 },
    { key: "rating", label: "Rating", accessor: (r) => (r.rating != null ? r.rating : "") },
  ];

  return (
    <ExportDialog<EngagementExportRow>
      open={open}
      onOpenChange={onOpenChange}
      title="Export Student Engagement"
      filenamePrefix="student_engagement"
      dateLabel="Month range"
      rows={rows}
      columns={columns}
      selectFilters={[
        {
          key: "team_leader",
          label: "Team Leader",
          options: [
            { value: "all", label: "All team leaders" },
            ...teamLeaders.map((tl) => ({ value: tl, label: tl })),
          ],
        },
        {
          key: "role",
          label: "Role",
          options: [
            { value: "all", label: "All" },
            { value: "tutor", label: "Tutors only" },
            { value: "mentor", label: "Mentors only" },
          ],
        },
        {
          key: "language",
          label: "Language",
          options: [
            { value: "all", label: "All languages" },
            ...languages.map((l) => ({ value: l, label: l })),
          ],
        },
        {
          key: "month",
          label: "Specific month",
          options: [
            { value: "all", label: "All months" },
            ...months.map((m) => ({ value: m, label: m })),
          ],
        },
      ]}
      applyFilters={(r, { dateFrom, dateTo, selects }) => {
        const m = r.month?.slice(0, 10) ?? "";
        if (dateFrom && m < dateFrom) return false;
        if (dateTo && m > dateTo) return false;
        const tl = selects.team_leader ?? "all";
        if (tl !== "all" && r.team_leader !== tl) return false;
        const role = selects.role ?? "all";
        if (role === "tutor" && r.is_mentor) return false;
        if (role === "mentor" && !r.is_mentor) return false;
        const lang = selects.language ?? "all";
        if (lang !== "all" && r.tutor_language !== lang) return false;
        const month = selects.month ?? "all";
        if (month !== "all" && r.month !== month) return false;
        return true;
      }}
    />
  );
}
