import { useCallback } from "react";
import { ExportDialog, type ExportColumn, type ExportSelectFilter } from "@/components/exports/ExportDialog";
import { supabase } from "@/integrations/supabase/client";

interface LiveIssueRow {
  id: string;
  case_id: string;
  session_id: string | null;
  session_date: string | null;
  time_slot: string | null;
  from_tutor_id: string | null;
  from_tutor_name: string | null;
  to_tutor_id: string | null;
  to_tutor_name: string | null;
  team_leader: string | null;
  issue_reason: string | null;
  issue_details: string | null;
  edu_validation: string | null;
  edu_notes: string | null;
  language: string | null;
  class_type: string | null;
  edu_description_id: string | null;
  edu_description_name?: string | null;
  last_synced_at: string;
  created_at: string;
}


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teamLeaders: string[];
  issueTypes: string[];
}

export function LiveIssuesExportDialog({ open, onOpenChange, teamLeaders, issueTypes }: Props) {
  const loadRows = useCallback(async (): Promise<LiveIssueRow[]> => {
    const PAGE = 1000;
    let from = 0;
    const all: any[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from("live_session_issues")
        .select("id, case_id, session_id, session_date, time_slot, from_tutor_id, from_tutor_name, to_tutor_id, to_tutor_name, team_leader, issue_reason, issue_details, edu_validation, edu_notes, language, class_type, last_synced_at, created_at")
        .order("session_date", { ascending: false, nullsFirst: false })
        .range(from, from + PAGE - 1);
      if (error || !data) break;
      all.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all as LiveIssueRow[];
  }, []);

  const columns: ExportColumn<LiveIssueRow>[] = [
    { key: "case_id", label: "Case ID", accessor: (r) => r.case_id },
    { key: "session_date", label: "Session Date", accessor: (r) => r.session_date ?? "" },
    { key: "time_slot", label: "Time Slot", accessor: (r) => r.time_slot ?? "" },
    { key: "session_id", label: "Session ID", accessor: (r) => r.session_id ?? "" },
    { key: "from_tutor_id", label: "From Tutor ID", accessor: (r) => r.from_tutor_id ?? "" },
    { key: "from_tutor_name", label: "From Tutor", accessor: (r) => r.from_tutor_name ?? "" },
    { key: "to_tutor_id", label: "To Tutor ID", accessor: (r) => r.to_tutor_id ?? "", defaultOn: false },
    { key: "to_tutor_name", label: "To Tutor", accessor: (r) => r.to_tutor_name ?? "", defaultOn: false },
    { key: "team_leader", label: "Team Leader", accessor: (r) => r.team_leader ?? "" },
    { key: "issue_reason", label: "Issue Reason", accessor: (r) => r.issue_reason ?? "" },
    { key: "issue_details", label: "Issue Details", accessor: (r) => r.issue_details ?? "" },
    { key: "edu_validation", label: "Edu Validation", accessor: (r) => r.edu_validation ?? "" },
    { key: "edu_notes", label: "Edu Notes", accessor: (r) => r.edu_notes ?? "", defaultOn: false },
    { key: "language", label: "Language", accessor: (r) => r.language ?? "", defaultOn: false },
    { key: "class_type", label: "Class Type", accessor: (r) => r.class_type ?? "", defaultOn: false },
    { key: "last_synced_at", label: "Last Synced", accessor: (r) => r.last_synced_at, defaultOn: false },
  ];

  const selectFilters: ExportSelectFilter[] = [
    {
      key: "team_leader", label: "Team Leader", options: [
        { value: "all", label: "All team leaders" },
        ...teamLeaders.map((tl) => ({ value: tl, label: tl })),
      ],
    },
    {
      key: "issue_reason", label: "Issue Type", options: [
        { value: "all", label: "All issue types" },
        ...issueTypes.map((t) => ({ value: t, label: t })),
      ],
    },
    {
      key: "edu_validation", label: "Edu Validation", options: [
        { value: "all", label: "All" },
        { value: "pending", label: "Pending" },
        { value: "deduct", label: "Deduct" },
        { value: "no_deduction", label: "No Deduction" },
        { value: "__none__", label: "Not validated" },
      ],
    },
  ];

  return (
    <ExportDialog<LiveIssueRow>
      open={open}
      onOpenChange={onOpenChange}
      title="Export Live Session Issues"
      filenamePrefix="live_session_issues"
      loadRows={loadRows}
      columns={columns}
      selectFilters={selectFilters}
      dateLabel="Session date"
      applyFilters={(r, { dateFrom, dateTo, selects }) => {
        if (selects.team_leader !== "all" && r.team_leader !== selects.team_leader) return false;
        if (selects.issue_reason !== "all" && r.issue_reason !== selects.issue_reason) return false;
        if (selects.edu_validation !== "all") {
          if (selects.edu_validation === "__none__") {
            if (r.edu_validation) return false;
          } else if (r.edu_validation !== selects.edu_validation) return false;
        }
        const d = r.session_date ?? "";
        if (dateFrom && (!d || d < dateFrom)) return false;
        if (dateTo && (!d || d > dateTo)) return false;
        return true;
      }}
    />
  );
}
