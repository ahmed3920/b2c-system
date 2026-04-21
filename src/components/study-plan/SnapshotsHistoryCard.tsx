import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Loader2 } from "lucide-react";
import { useStudyPlanSnapshots } from "@/hooks/useStudyPlanSnapshots";
import { format } from "date-fns";

interface Props {
  onView: (weekStart: string) => void;
  currentWeekStart: string;
}

export function SnapshotsHistoryCard({ onView, currentWeekStart }: Props) {
  const { data: snapshots = [], isLoading } = useStudyPlanSnapshots();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generated weeks history</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Each generation is saved here. Older weeks are preserved when you
          generate a new one — re-generating the same week overwrites only that
          week.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : snapshots.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            No generated weeks yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week start</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="text-center">Tutors</TableHead>
                <TableHead className="text-center">Modules</TableHead>
                <TableHead className="text-center">Free h</TableHead>
                <TableHead className="text-center">Planned h</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((s) => (
                <TableRow
                  key={s.id}
                  className={
                    s.week_start === currentWeekStart ? "bg-muted/40" : ""
                  }
                >
                  <TableCell className="font-medium">{s.week_start}</TableCell>
                  <TableCell>
                    {s.team_leader ?? (
                      <span className="text-muted-foreground">All teams</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{s.tutors_count}</TableCell>
                  <TableCell className="text-center">{s.items_count}</TableCell>
                  <TableCell className="text-center">{s.total_free_hours}</TableCell>
                  <TableCell className="text-center">{s.total_planned_hours}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(s.created_at), "PP p")}
                    {s.generated_by_name ? ` · ${s.generated_by_name}` : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onView(s.week_start)}
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
