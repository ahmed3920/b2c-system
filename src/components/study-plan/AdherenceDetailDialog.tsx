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
import { CheckCircle2, XCircle } from "lucide-react";
import { AdherenceStatusBadge } from "./AdherenceStatusBadge";
import type { TutorAdherence } from "@/hooks/useWeekAdherence";

interface Props {
  tutor: TutorAdherence | null;
  weekStart: string;
  onClose: () => void;
}

export function AdherenceDetailDialog({ tutor, weekStart, onClose }: Props) {
  return (
    <Dialog open={!!tutor} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        {tutor && (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle>{tutor.tutor_name}</DialogTitle>
                  <DialogDescription>
                    {tutor.tutor_external_id} · {tutor.team_leader} · Week of{" "}
                    {weekStart}
                  </DialogDescription>
                </div>
                <AdherenceStatusBadge status={tutor.status} />
              </div>
            </DialogHeader>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2">
              <Stat label="Planned modules" value={tutor.planned_count} />
              <Stat
                label="Finished (planned)"
                value={`${tutor.finished_planned_count}/${tutor.planned_count}`}
              />
              <Stat
                label="Sessions (actual / sched.)"
                value={`${tutor.actual_sessions_post ?? "—"} / ${tutor.scheduled_sessions_pre ?? "—"}`}
              />
              <Stat label="Adherence" value={`${tutor.adherence_pct}%`} />
            </div>

            {!tutor.has_post_data && (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                No post-week data synced for this tutor yet. Sync the
                "Published modules — after week" sheet to compare.
              </div>
            )}

            <div className="mt-2">
              <h4 className="text-sm font-medium mb-2">
                Plan vs Actual — modules
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grade</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Planned hours</TableHead>
                    <TableHead>Finished?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tutor.planned_modules.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        No modules in plan
                      </TableCell>
                    </TableRow>
                  ) : (
                    tutor.planned_modules.map((m) => (
                      <TableRow key={m.module_id}>
                        <TableCell>{m.grade_band}</TableCell>
                        <TableCell>
                          {m.module_code}
                          {m.is_partial && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              partial
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {m.planned_hours} / {m.hours_required}h
                        </TableCell>
                        <TableCell>
                          {m.is_finished ? (
                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                              <CheckCircle2 className="h-4 w-4" /> Finished
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
                              <XCircle className="h-4 w-4" /> Not finished
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {tutor.extra_finished_count > 0 && (
              <p className="text-xs text-muted-foreground">
                Tutor also finished {tutor.extra_finished_count} module(s) that
                were not in this week's plan.
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
