import { useMemo } from "react";
import { ExportDialog, type ExportColumn, type ExportSelectFilter } from "@/components/exports/ExportDialog";
import type { CSTicket } from "@/components/cs-tickets/useCSTickets";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tickets: CSTicket[];
}

const normTL = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

export function CSTicketsExportDialog({ open, onOpenChange, tickets }: Props) {
  const teamLeaders = useMemo(() => {
    const s = new Set<string>();
    tickets.forEach((t) => { const v = normTL(t.team_leader); if (v) s.add(v); });
    return Array.from(s).sort();
  }, [tickets]);

  const columns: ExportColumn<CSTicket>[] = [
    { key: "ticket_number", label: "Ticket #", accessor: (r) => r.ticket_number },
    { key: "ticket_date", label: "Ticket Date", accessor: (r) => r.ticket_date },
    { key: "status", label: "Status", accessor: (r) => r.status },
    { key: "case_types", label: "Case Types", accessor: (r) => r.case_types.join(", ") },
    { key: "cs_category", label: "CS Category", accessor: (r) => r.cs_category ?? "" },
    { key: "edu_category", label: "Edu Category", accessor: (r) => r.edu_category ?? "" },
    { key: "category", label: "Category (legacy)", accessor: (r) => r.category, defaultOn: false },
    { key: "tutor_external_id", label: "Tutor ID", accessor: (r) => r.tutor_external_id },
    { key: "tutor_name", label: "Tutor Name", accessor: (r) => r.tutor_name },
    { key: "team_leader", label: "Team Leader", accessor: (r) => r.team_leader },
    { key: "additional_tutors", label: "Additional Tutors", accessor: (r) => (r.additional_tutors ?? []).map((t) => `${t.tutor_external_id} ${t.tutor_name}`).join(" | "), defaultOn: false },
    { key: "student_id", label: "Student ID", accessor: (r) => r.student_id ?? "" },
    { key: "session", label: "Session # / Date", accessor: (r) => r.session_num_or_date ?? "" },
    { key: "case_details", label: "Case Details", accessor: (r) => r.case_details ?? "" },
    { key: "deadline", label: "Need-Response Deadline", accessor: (r) => r.need_response_deadline ?? "" },
    { key: "team_leader_response", label: "TL Response", accessor: (r) => r.team_leader_response ?? "" },
    { key: "assigned_mentor_name", label: "Assigned Mentor", accessor: (r) => r.assigned_mentor_name ?? "" },
    { key: "mentor_validation", label: "Mentor Validation", accessor: (r) => r.mentor_validation ?? "" },
    { key: "mentor_evaluation_notes", label: "Mentor Notes", accessor: (r) => r.mentor_evaluation_notes ?? "", defaultOn: false },
    { key: "mentor_recommendation", label: "Mentor Recommendation", accessor: (r) => r.mentor_recommendation ?? "", defaultOn: false },
    { key: "created_by_name", label: "Created By", accessor: (r) => r.created_by_name ?? "" },
    { key: "created_at", label: "Created At", accessor: (r) => r.created_at },
    { key: "closed_at", label: "Closed At", accessor: (r) => r.closed_at ?? "", defaultOn: false },
    { key: "closed_by_name", label: "Closed By", accessor: (r) => r.closed_by_name ?? "", defaultOn: false },
  ];

  const selectFilters: ExportSelectFilter[] = [
    {
      key: "status", label: "Status", options: [
        { value: "all", label: "All statuses" },
        { value: "Pending", label: "Pending" },
        { value: "Valid", label: "Valid" },
        { value: "Not Valid", label: "Not Valid" },
        { value: "Not a Complain", label: "Not a Complain" },
      ],
    },
    {
      key: "case_type", label: "Case Type", options: [
        { value: "all", label: "All types" },
        { value: "CS", label: "CS" },
        { value: "Edu", label: "Edu" },
      ],
    },
    {
      key: "team_leader", label: "Team Leader", options: [
        { value: "all", label: "All team leaders" },
        ...teamLeaders.map((tl) => ({ value: tl, label: tl })),
      ],
    },
  ];

  return (
    <ExportDialog<CSTicket>
      open={open}
      onOpenChange={onOpenChange}
      title="Export CS Tickets"
      filenamePrefix="cs_tickets"
      rows={tickets}
      columns={columns}
      selectFilters={selectFilters}
      dateLabel="Ticket date"
      applyFilters={(r, { dateFrom, dateTo, selects }) => {
        if (selects.status !== "all" && r.status !== selects.status) return false;
        if (selects.case_type !== "all" && !r.case_types.includes(selects.case_type as any)) return false;
        if (selects.team_leader !== "all" && normTL(r.team_leader) !== selects.team_leader) return false;
        const d = r.ticket_date ?? r.created_at?.slice(0, 10) ?? "";
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      }}
    />
  );
}
