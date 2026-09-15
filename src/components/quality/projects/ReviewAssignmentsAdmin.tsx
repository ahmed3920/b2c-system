import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Shuffle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAssignmentAdmin } from "@/hooks/useProjectReviews";

/** Admin controls: the daily number per reviewer and today's distribution. */
export function ReviewAssignmentsAdmin() {
  const { toast } = useToast();
  const { rows, byReviewer, limit, loading, running, saveLimit, generate, release, refetch } =
    useAssignmentAdmin(true);
  const [value, setValue] = useState<string>("");

  const today = new Date().toISOString().slice(0, 10);
  const todays = rows.filter((r) => r.assigned_on === today);

  const save = async () => {
    const num = Number(value || limit);
    if (!Number.isFinite(num) || num < 1) {
      toast({ title: "Enter a number of 1 or more", variant: "destructive" });
      return;
    }
    try {
      await saveLimit(num);
      toast({ title: `Daily number set to ${num} projects per reviewer` });
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const run = async () => {
    try {
      const res = await generate();
      toast({
        title: res?.message ?? `${res?.assigned ?? 0} projects assigned`,
        description: res?.message ? undefined : `Across ${res?.reviewers ?? 0} reviewers`,
      });
    } catch (e) {
      toast({
        title: "Could not generate the batch",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Daily assignment settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Projects per reviewer per day</Label>
            <Input
              type="number"
              min={1}
              className="h-9 w-[160px]"
              value={value === "" ? String(limit) : value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <Button onClick={save} className="h-9">Save</Button>
          <Button variant="outline" className="h-9" onClick={run} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Shuffle className="h-4 w-4 mr-1" />}
            Generate today's batch
          </Button>
          <Button variant="ghost" className="h-9" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reviewers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reviewer</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byReviewer.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{r.open}</TableCell>
                  <TableCell className="text-right">{r.done}</TableCell>
                </TableRow>
              ))}
              {!byReviewer.length && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    No assignments yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Assigned today {loading && <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />}
          </CardTitle>
          <span className="text-sm text-muted-foreground">{todays.length} projects</span>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {todays.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-[220px] truncate">
                      {a.project_title || `Project ${a.project_id}`}
                    </TableCell>
                    <TableCell>{a.student_name ?? "—"}</TableCell>
                    <TableCell>{a.tutor_name ?? "—"}</TableCell>
                    <TableCell>{a.assigned_to_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={a.state === "done" ? "default" : "outline"}>{a.state}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => release(a.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && !todays.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Nothing assigned today yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
