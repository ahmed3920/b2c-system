import * as XLSX from "xlsx";
import type { WeeklyPlan } from "@/hooks/useWeeklyStudyPlans";

export function exportStudyPlanToExcel(plans: WeeklyPlan[], weekStart: string) {
  const summary = plans.map((p) => ({
    Tutor: p.tutor_name,
    "Tutor ID": p.tutor_external_id,
    "Team Leader": p.team_leader,
    "Free hours": p.free_hours,
    "Planned hours": p.planned_hours,
    "Modules count": p.items?.length ?? 0,
    Status: p.status,
    Notes: p.notes ?? "",
  }));

  const detailed: Array<Record<string, string | number>> = [];
  for (const p of plans) {
    if (!p.items || p.items.length === 0) {
      detailed.push({
        Tutor: p.tutor_name,
        "Tutor ID": p.tutor_external_id,
        "Team Leader": p.team_leader,
        Grade: "",
        Module: "",
        "Planned hours": "",
        "Required hours": "",
        "Completion %": "",
        Type: "No modules",
      });
      continue;
    }
    for (const it of p.items) {
      const required = it.module?.hours_required ?? 0;
      const pct = required > 0 ? Math.round((it.planned_hours / required) * 100) : 0;
      detailed.push({
        Tutor: p.tutor_name,
        "Tutor ID": p.tutor_external_id,
        "Team Leader": p.team_leader,
        Grade: it.module?.grade_band ?? "",
        Module: it.module?.module_code ?? "",
        "Planned hours": it.planned_hours,
        "Required hours": required,
        "Completion %": `${pct}%`,
        Type: it.is_partial ? "Partial — carry over" : "Full",
      });
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailed), "Modules");
  XLSX.writeFile(wb, `weekly-study-plan-${weekStart}.xlsx`);
}
