import { useMemo } from "react";
import { ExportDialog, type ExportColumn, type ExportSelectFilter } from "@/components/exports/ExportDialog";
import type { SessionIncident } from "@/hooks/useSessionIncidents";

const canon = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: SessionIncident[];
}

export function SessionIncidentsExportDialog({ open, onOpenChange, items }: Props) {
  const teamLeaders = useMemo(() => {
    const s = new Set<string>();
    items.forEach((r) => { const v = canon(r.team_leader); if (v) s.add(v); });
    return Array.from(s).sort();
  }, [items]);

  const mentors = useMemo(() => {
    const s = new Set<string>();
    items.forEach((r) => { const v = canon(r.assigned_mentor_name); if (v) s.add(v); });
    return Array.from(s).sort();
  }, [items]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    items.forEach((r) => r.case_category && s.add(r.case_category));
    return Array.from(s).sort();
  }, [items]);

  const columns: ExportColumn<SessionIncident>[] = [
    { key: "created_at", label: "Created At", accessor: (r) => r.created_at },
    { key: "tutor_external_id", label: "Tutor ID", accessor: (r) => r.tutor_external_id },
    { key: "tutor_name", label: "Tutor Name", accessor: (r) => r.tutor_name },
    { key: "team_leader", label: "Team Leader", accessor: (r) => r.team_leader },
    { key: "assigned_mentor_name", label: "Assigned Mentor", accessor: (r) => r.assigned_mentor_name ?? "" },
    { key: "student_id", label: "Student ID", accessor: (r) => r.student_id ?? "" },
    { key: "student_name", label: "Student Name", accessor: (r) => r.student_name ?? "" },
    { key: "student_grade", label: "Grade", accessor: (r) => r.student_grade ?? "" },
    { key: "session_date", label: "Session Date", accessor: (r) => r.session_date ?? "" },
    { key: "session_number", label: "Session #", accessor: (r) => r.session_number ?? "" },
    { key: "case_category", label: "Category", accessor: (r) => r.case_category },
    { key: "case_description", label: "Description", accessor: (r) => r.case_description ?? "" },
    { key: "supporting_link", label: "Supporting Link", accessor: (r) => r.supporting_link ?? "", defaultOn: false },
    { key: "source", label: "Source", accessor: (r) => r.source },
    { key: "submitted_by_name", label: "Submitted By", accessor: (r) => r.submitted_by_name ?? "" },
    { key: "validation_status", label: "Validation", accessor: (r) => r.validation_status },
    { key: "validated_by_name", label: "Validated By", accessor: (r) => r.validated_by_name ?? "" },
    { key: "validated_at", label: "Validated At", accessor: (r) => r.validated_at ?? "" },
    { key: "rejection_reason", label: "Rejection Reason", accessor: (r) => r.rejection_reason ?? "", defaultOn: false },
    { key: "sent_to_cs", label: "Sent to CS", accessor: (r) => (r.sent_to_cs ? "Yes" : "No") },
    { key: "cs_ticket_number", label: "CS Ticket #", accessor: (r) => r.cs_ticket_number ?? "" },
    { key: "cs_status", label: "CS Status", accessor: (r) => r.cs_status ?? "" },
  ];

  const selectFilters: ExportSelectFilter[] = [
    {
      key: "validation_status", label: "Validation", options: [
        { value: "all", label: "All statuses" },
        { value: "pending", label: "Pending" },
        { value: "approved", label: "Approved" },
        { value: "rejected", label: "Rejected" },
      ],
    },
    {
      key: "source", label: "Source", options: [
        { value: "all", label: "All sources" },
        { value: "staff", label: "Staff" },
        { value: "tutor_self", label: "Tutor self" },
      ],
    },
    {
      key: "sent_to_cs", label: "Sent to CS", options: [
        { value: "all", label: "All" },
        { value: "yes", label: "Sent" },
        { value: "no", label: "Not sent" },
      ],
    },
    {
      key: "category", label: "Category", options: [
        { value: "all", label: "All categories" },
        ...categories.map((c) => ({ value: c, label: c })),
      ],
    },
    {
      key: "team_leader", label: "Team Leader", options: [
        { value: "all", label: "All team leaders" },
        ...teamLeaders.map((tl) => ({ value: tl, label: tl })),
      ],
    },
    {
      key: "mentor", label: "Mentor", options: [
        { value: "all", label: "All mentors" },
        ...mentors.map((m) => ({ value: m, label: m })),
      ],
    },
  ];

  return (
    <ExportDialog<SessionIncident>
      open={open}
      onOpenChange={onOpenChange}
      title="Export Session Incidents"
      filenamePrefix="session_incidents"
      rows={items}
      columns={columns}
      selectFilters={selectFilters}
      dateLabel="Session date"
      applyFilters={(r, { dateFrom, dateTo, selects }) => {
        if (selects.validation_status !== "all" && r.validation_status !== selects.validation_status) return false;
        if (selects.source !== "all" && r.source !== selects.source) return false;
        if (selects.sent_to_cs !== "all" && (selects.sent_to_cs === "yes") !== !!r.sent_to_cs) return false;
        if (selects.category !== "all" && r.case_category !== selects.category) return false;
        if (selects.team_leader !== "all" && canon(r.team_leader) !== selects.team_leader) return false;
        if (selects.mentor !== "all" && canon(r.assigned_mentor_name) !== selects.mentor) return false;
        const d = r.session_date || r.created_at.slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      }}
    />
  );
}
