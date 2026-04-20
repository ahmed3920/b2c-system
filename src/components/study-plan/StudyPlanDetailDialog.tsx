import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { WeeklyPlan } from "@/hooks/useWeeklyStudyPlans";

interface Props {
  plan: WeeklyPlan | null;
  onClose: () => void;
}

export function StudyPlanDetailDialog({ plan, onClose }: Props) {
  return (
    <Dialog open={!!plan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {plan && (
          <>
            <DialogHeader>
              <DialogTitle>{plan.tutor_name}</DialogTitle>
              <DialogDescription>
                {plan.tutor_external_id} · {plan.team_leader} · Week of{" "}
                {plan.week_start}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3 py-2">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Free hours</div>
                <div className="text-2xl font-semibold">{plan.free_hours}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Planned</div>
                <div className="text-2xl font-semibold">
                  {plan.planned_hours}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Modules</div>
                <div className="text-2xl font-semibold">
                  {plan.items?.length ?? 0}
                </div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grade</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(plan.items ?? []).map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.module?.grade_band ?? "—"}</TableCell>
                    <TableCell>{it.module?.module_code ?? "—"}</TableCell>
                    <TableCell>
                      {it.planned_hours}
                      {it.module ? ` / ${it.module.hours_required}` : ""}
                    </TableCell>
                    <TableCell>
                      {it.is_partial ? (
                        <Badge variant="secondary">Partial — carry over</Badge>
                      ) : (
                        <Badge>Full</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!plan.items || plan.items.length === 0) && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      No modules assigned
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
