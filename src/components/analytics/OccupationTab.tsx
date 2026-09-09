import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { TUTOR_STATUS_OPTIONS, tutorStatusLabel } from "@/lib/tutorStatus";
import { SearchableSelect } from "@/components/tracking/quality/QualityFilterBar";
import { useOccupation, useTeamComposition, type OccupationRow } from "@/hooks/useAnalytics";

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

const pct = (v: string | number | null) => (v === null || v === undefined ? null : Number(v));

function OccupationView({ role }: { role: "all" | "tutor" | "mentor" }) {
  const [status, setStatus] = useState("0");
  const [teamLeader, setTeamLeader] = useState("");
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [search, setSearch] = useState("");
  const { teamLeaders } = useTeamComposition(status, "");
  const { rows, summary, loading, error, refetch } = useOccupation({
    status,
    teamLeader,
    dateFrom,
    dateTo,
    role,
    search,
  });

  const exportCsv = () => {
    const header = ["Tutor ID", "Name", "Team leader", "Type", "Employment", "Status", "Working days", "Target", "Delivered", "Occupation %"];
    const line = (r: OccupationRow) =>
      [
        r.tutor_tid,
        `"${r.name ?? ""}"`,
        `"${r.team_leader ?? ""}"`,
        r.is_mentor ? "Mentor" : "Tutor",
        r.employment_type === 1 ? "Part-time" : "Full-time",
        tutorStatusLabel(r.tutor_status),
        r.working_days,
        r.target,
        r.delivered,
        pct(r.occupation) ?? "",
      ].join(",");
    const blob = new Blob([[header.join(","), ...rows.map(line)].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `occupation-${role}-${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <Label>From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {TUTOR_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Team leader</Label>
            <SearchableSelect value={teamLeader} onChange={setTeamLeader} options={teamLeaders} allLabel="All team leaders" />
          </div>
          <div className="space-y-1">
            <Label>Search</Label>
            <Input placeholder="Name or T-ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-end gap-2 md:col-span-5">
            <Button variant="outline" onClick={refetch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 md:grid-cols-5">
        {[
          ["People", summary?.people ?? 0],
          ["Sessions delivered", summary?.delivered ?? 0],
          ["Target (5/working day)", summary?.target ?? 0],
          ["Avg occupation", summary?.avg_occupation ? `${Number(summary.avg_occupation)}%` : "—"],
          ["At target", summary?.at_target ?? 0],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold">{value as string | number}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tutor</TableHead>
                <TableHead>Team leader</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Employment</TableHead>
                <TableHead className="text-right">Working days</TableHead>
                <TableHead className="text-right">Delivered / Target</TableHead>
                <TableHead className="w-48">Occupation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !rows.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
              ) : (
                rows.map((r) => {
                  const p = pct(r.occupation);
                  return (
                    <TableRow key={r.tutor_tid}>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.tutor_tid}</div>
                      </TableCell>
                      <TableCell>{r.team_leader}</TableCell>
                      <TableCell>
                        <Badge variant={r.is_mentor ? "default" : "secondary"}>{r.is_mentor ? "Mentor" : "Tutor"}</Badge>
                      </TableCell>
                      <TableCell>{r.employment_type === 1 ? "Part-time" : "Full-time"}</TableCell>
                      <TableCell className="text-right">{r.working_days}</TableCell>
                      <TableCell className="text-right">{r.delivered} / {r.target}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(p ?? 0, 100)} className="h-2" />
                          <span className="text-xs w-12 text-right">{p === null ? "—" : `${p}%`}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function OccupationTab() {
  return (
    <Tabs defaultValue="all" className="space-y-4">
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="tutor">Tutors</TabsTrigger>
        <TabsTrigger value="mentor">Mentors</TabsTrigger>
      </TabsList>
      <TabsContent value="all"><OccupationView role="all" /></TabsContent>
      <TabsContent value="tutor"><OccupationView role="tutor" /></TabsContent>
      <TabsContent value="mentor"><OccupationView role="mentor" /></TabsContent>
    </Tabs>
  );
}
