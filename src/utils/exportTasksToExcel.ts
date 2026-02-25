import * as XLSX from "xlsx";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

interface ExportOptions {
  tasks: Task[];
  ownerNames?: Record<string, string>;
  fileName?: string;
}

const priorityLabels: Record<number, string> = {
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
};

const statusLabels: Record<string, string> = {
  todo: "To-Do",
  in_progress: "In Progress",
  done: "Done",
  archived: "Archived",
};

export function exportTasksToExcel({ tasks, ownerNames, fileName }: ExportOptions) {
  const rows = tasks.map((task) => ({
    "Owner": ownerNames?.[task.user_id] || task.user_id,
    "Task Type": task.task_type,
    "Description": task.description,
    "Status": statusLabels[task.status] || task.status,
    "Priority": priorityLabels[task.priority ?? 2] || String(task.priority),
    "Start Date": task.date_from || "",
    "Due Date": task.date_to || "",
    "Start Time": task.start_time || "",
    "End Time": task.end_time || "",
    "Duration (min)": task.duration_minutes ?? "",
    "Related Link": task.related_link || "",
    "Created At": new Date(task.created_at).toLocaleDateString("en-GB"),
    "Updated At": new Date(task.updated_at).toLocaleDateString("en-GB"),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  const colWidths = Object.keys(rows[0] || {}).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...rows.map((r) => String((r as Record<string, unknown>)[key] ?? "").length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "All Tasks");

  // Add a summary sheet
  const statusCounts = Object.entries(
    tasks.reduce<Record<string, number>>((acc, t) => {
      const label = statusLabels[t.status] || t.status;
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {})
  ).map(([Status, Count]) => ({ Status, Count }));

  const summarySheet = XLSX.utils.json_to_sheet([
    { Metric: "Total Tasks", Value: tasks.length },
    ...statusCounts.map((s) => ({ Metric: s.Status, Value: s.Count })),
  ]);
  summarySheet["!cols"] = [{ wch: 20 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  const name = fileName || `all_tasks_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(workbook, name);
}
