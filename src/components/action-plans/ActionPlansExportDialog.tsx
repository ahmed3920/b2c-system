import { useMemo } from "react";
import { ExportDialog, type ExportColumn, type ExportSelectFilter } from "@/components/exports/ExportDialog";
import {
  CATEGORY_LABELS, STATUS_LABELS,
  type ActionPlan, type ActionPlanCategory, type ActionPlanStatus,
} from "@/hooks/useActionPlans";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plans: ActionPlan[];
}

export function ActionPlansExportDialog({ open, onOpenChange, plans }: Props) {
  const teamLeaders = useMemo(
    () => Array.from(new Set(plans.map((p) => p.team_leader).filter(Boolean))).sort(),
    [plans],
  );

  const columns: ExportColumn<ActionPlan>[] = [
    { key: "tutor_external_id", label: "Tutor ID", accessor: (p) => p.tutor_external_id ?? "" },
    { key: "tutor_name", label: "Tutor Name", accessor: (p) => p.tutor_name },
    { key: "team_leader", label: "Team Leader", accessor: (p) => p.team_leader },
    { key: "category", label: "Category", accessor: (p) => CATEGORY_LABELS[p.category] ?? p.category },
    { key: "status", label: "Status", accessor: (p) => STATUS_LABELS[p.status] ?? p.status },
    { key: "summary", label: "Summary", accessor: (p) => p.summary ?? "" },
    { key: "start_date", label: "Start Date", accessor: (p) => p.start_date },
    { key: "due_date", label: "Due Date", accessor: (p) => p.due_date },
    { key: "progress", label: "Progress (%)", accessor: (p) => p.progress },
    { key: "evaluation", label: "Evaluation", accessor: (p) => p.evaluation ?? "" },
    { key: "evaluation_notes", label: "Evaluation Notes", accessor: (p) => p.evaluation_notes ?? "", defaultOn: false },
    { key: "resolved_at", label: "Resolved At", accessor: (p) => p.resolved_at ?? "" },
    { key: "quality_baseline_score", label: "Quality Baseline", accessor: (p) => p.quality_baseline_score ?? "", defaultOn: false },
    { key: "quality_month1_score", label: "Quality M1", accessor: (p) => p.quality_month1_score ?? "", defaultOn: false },
    { key: "quality_month2_score", label: "Quality M2", accessor: (p) => p.quality_month2_score ?? "", defaultOn: false },
    { key: "quality_month3_score", label: "Quality M3", accessor: (p) => p.quality_month3_score ?? "", defaultOn: false },
    { key: "created_at", label: "Created At", accessor: (p) => p.created_at },
  ];

  const selectFilters: ExportSelectFilter[] = [
    {
      key: "status", label: "Status", options: [
        { value: "all", label: "All statuses" },
        ...(Object.keys(STATUS_LABELS) as ActionPlanStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] })),
      ],
    },
    {
      key: "category", label: "Category", options: [
        { value: "all", label: "All categories" },
        ...(Object.keys(CATEGORY_LABELS) as ActionPlanCategory[]).map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
      ],
    },
    {
      key: "team_leader", label: "Team Leader", options: [
        { value: "all", label: "All team leaders" },
        ...teamLeaders.map((tl) => ({ value: tl, label: tl })),
      ],
    },
    {
      key: "evaluation", label: "Evaluation", options: [
        { value: "all", label: "All" },
        { value: "improved", label: "Improved" },
        { value: "not_improved", label: "Not improved" },
        { value: "__none__", label: "Not evaluated" },
      ],
    },
    {
      key: "date_field", label: "Date range applies to", options: [
        { value: "created_at", label: "Created date" },
        { value: "start_date", label: "Start date" },
        { value: "due_date", label: "Due date" },
      ], defaultValue: "created_at",
    },
  ];

  return (
    <ExportDialog<ActionPlan>
      open={open}
      onOpenChange={onOpenChange}
      title="Export Action Plans"
      filenamePrefix="action_plans"
      rows={plans}
      columns={columns}
      selectFilters={selectFilters}
      dateLabel="Date range"
      applyFilters={(p, { dateFrom, dateTo, selects }) => {
        if (selects.status !== "all" && p.status !== selects.status) return false;
        if (selects.category !== "all" && p.category !== selects.category) return false;
        if (selects.team_leader !== "all" && p.team_leader !== selects.team_leader) return false;
        if (selects.evaluation !== "all") {
          if (selects.evaluation === "__none__") { if (p.evaluation) return false; }
          else if (p.evaluation !== selects.evaluation) return false;
        }
        const field = selects.date_field ?? "created_at";
        const d =
          field === "start_date" ? p.start_date :
          field === "due_date" ? p.due_date :
          (p.created_at ?? "").slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      }}
    />
  );
}
