import * as XLSX from "xlsx";
import type { WeeklyPlan } from "@/hooks/useWeeklyStudyPlans";

export function exportStudyPlanToExcel(plans: WeeklyPlan[], weekStart: string) {
  const summary = plans.map((p) => {
    const modulesList =
      (p.items ?? [])
        .map((it) => {
          const required = it.module?.hours_required ?? 0;
          const pct =
            required > 0 ? Math.round((it.planned_hours / required) * 100) : 0;
          const grade = it.module?.grade_band ?? "?";
          const code = it.module?.module_code ?? "?";
          const partial = it.is_partial ? " (partial)" : "";
          return `${grade} · ${code} — ${it.planned_hours}/${required}h (${pct}%)${partial}`;
        })
        .join("\n") || "—";
    return {
      Tutor: p.tutor_name,
      "Tutor ID": p.tutor_external_id,
      "Team Leader": p.team_leader,
      "Free hours": p.free_hours,
      "Planned hours": p.planned_hours,
      "Modules count": p.items?.length ?? 0,
      Modules: modulesList,
      Status: p.status,
      Notes: p.notes ?? "",
    };
  });

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
  const summarySheet = XLSX.utils.json_to_sheet(summary);
  summarySheet["!cols"] = [
    { wch: 24 }, { wch: 12 }, { wch: 18 }, { wch: 10 },
    { wch: 12 }, { wch: 14 }, { wch: 60 }, { wch: 12 }, { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
  const modulesSheet = XLSX.utils.json_to_sheet(detailed);
  modulesSheet["!cols"] = [
    { wch: 24 }, { wch: 12 }, { wch: 18 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, modulesSheet, "Modules");
  XLSX.writeFile(wb, `weekly-study-plan-${weekStart}.xlsx`);
}
