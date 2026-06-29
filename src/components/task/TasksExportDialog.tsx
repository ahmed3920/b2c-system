import { ExportDialog, type ExportColumn, type ExportSelectFilter } from "@/components/exports/ExportDialog";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const statusLabels: Record<string, string> = {
  todo: "To-Do",
  in_progress: "In Progress",
  done: "Done",
  archived: "Archived",
};

const priorityLabels: Record<number, string> = {
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tasks: Task[];
  ownerNames: Record<string, string>;
}

export function TasksExportDialog({ open, onOpenChange, tasks, ownerNames }: Props) {
  const owners = Array.from(new Set(tasks.map((t) => t.user_id)))
    .map((id) => ({ value: id, label: ownerNames[id] || id }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const types = Array.from(new Set(tasks.map((t) => t.task_type).filter(Boolean))).sort();

  const selectFilters: ExportSelectFilter[] = [
    {
      key: "owner",
      label: "Assignee",
      options: [{ value: "all", label: "All assignees" }, ...owners],
    },
    {
      key: "status",
      label: "Status",
      options: [
        { value: "all", label: "All statuses" },
        { value: "todo", label: "To-Do" },
        { value: "in_progress", label: "In Progress" },
        { value: "done", label: "Done" },
        { value: "archived", label: "Archived" },
      ],
    },
    {
      key: "priority",
      label: "Priority",
      options: [
        { value: "all", label: "All priorities" },
        { value: "1", label: "Low" },
        { value: "2", label: "Medium" },
        { value: "3", label: "High" },
        { value: "4", label: "Urgent" },
      ],
    },
    {
      key: "type",
      label: "Task type",
      options: [{ value: "all", label: "All types" }, ...types.map((t) => ({ value: t, label: t }))],
    },
    {
      key: "dateField",
      label: "Date range applies to",
      options: [
        { value: "created_at", label: "Created date" },
        { value: "date_to", label: "Due date" },
        { value: "date_from", label: "Start date" },
      ],
      defaultValue: "created_at",
    },
  ];

  const columns: ExportColumn<Task>[] = [
    { key: "owner", label: "Assignee", accessor: (r) => ownerNames[r.user_id] || r.user_id },
    { key: "type", label: "Task Type", accessor: (r) => r.task_type },
    { key: "description", label: "Description", accessor: (r) => r.description },
    { key: "status", label: "Status", accessor: (r) => statusLabels[r.status] || r.status },
    { key: "priority", label: "Priority", accessor: (r) => priorityLabels[r.priority ?? 2] || String(r.priority) },
    { key: "date_from", label: "Start Date", accessor: (r) => r.date_from || "" },
    { key: "date_to", label: "Due Date", accessor: (r) => r.date_to || "" },
    { key: "start_time", label: "Start Time", accessor: (r) => r.start_time || "" },
    { key: "end_time", label: "End Time", accessor: (r) => r.end_time || "" },
    { key: "duration", label: "Duration (min)", accessor: (r) => r.duration_minutes ?? "" },
    { key: "link", label: "Related Link", accessor: (r) => r.related_link || "" },
    { key: "created_at", label: "Created At", accessor: (r) => r.created_at?.slice(0, 10) || "" },
    { key: "updated_at", label: "Updated At", accessor: (r) => r.updated_at?.slice(0, 10) || "", defaultOn: false },
  ];

  return (
    <ExportDialog<Task>
      open={open}
      onOpenChange={onOpenChange}
      title="Export Tasks"
      filenamePrefix="tasks"
      dateLabel="Date range"
      columns={columns}
      selectFilters={selectFilters}
      rows={tasks}
      applyFilters={(row, { dateFrom, dateTo, selects }) => {
        if (selects.owner && selects.owner !== "all" && row.user_id !== selects.owner) return false;
        if (selects.status && selects.status !== "all" && row.status !== selects.status) return false;
        if (selects.priority && selects.priority !== "all" && String(row.priority ?? "") !== selects.priority) return false;
        if (selects.type && selects.type !== "all" && row.task_type !== selects.type) return false;
        const field = (selects.dateField as keyof Task) || "created_at";
        const raw = (row[field] as string | null) ?? "";
        const d = raw ? raw.slice(0, 10) : "";
        if (dateFrom && (!d || d < dateFrom)) return false;
        if (dateTo && (!d || d > dateTo)) return false;
        return true;
      }}
    />
  );
}
