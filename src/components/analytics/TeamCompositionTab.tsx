import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TUTOR_STATUS_OPTIONS } from "@/lib/tutorStatus";
import { SearchableSelect } from "@/components/tracking/quality/QualityFilterBar";
import { useTeamComposition } from "@/hooks/useAnalytics";

export function TeamCompositionTab() {
  const [status, setStatus] = useState("0");
  const [teamLeader, setTeamLeader] = useState("");
  const { rows, teamLeaders, loading, error, refetch } = useTeamComposition(status, teamLeader);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          total: acc.total + r.total,
          tutors: acc.tutors + r.tutors,
          mentors: acc.mentors + r.mentors,
          full_time: acc.full_time + r.full_time,
          part_time: acc.part_time + r.part_time,
        }),
        { total: 0, tutors: 0, mentors: 0, full_time: 0, part_time: 0 },
      ),
    [rows],
  );

  const exportCsv = () => {
    const header = [
      "Team leader",
      "Total",
      "Tutors",
      "Mentors",
      "Full-time",
      "Part-time",
      "Tutors full-time",
      "Tutors part-time",
      "Mentors full-time",
      "Mentors part-time",
    ];
    const lines = [header.join(",")].concat(
      rows.map((r) =>
        [
          `"${r.team_leader}"`,
          r.total,
          r.tutors,
          r.mentors,
          r.full_time,
          r.part_time,
          r.tutors_full_time,
          r.tutors_part_time,
          r.mentors_full_time,
          r.mentors_part_time,
        ].join(","),
      ),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "team-composition.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
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
            <SearchableSelect
              value={teamLeader}
              onChange={setTeamLeader}
              options={teamLeaders}
              allLabel="All team leaders"
            />
          </div>
          <div className="flex items-end gap-2 md:col-span-2">
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
          ["Total members", totals.total],
          ["Tutors", totals.tutors],
          ["Mentors", totals.mentors],
          ["Full-time", totals.full_time],
          ["Part-time", totals.part_time],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold">{value as number}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Composition per team</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="team_leader" tick={{ fontSize: 11 }} interval={0} angle={-12} height={60} textAnchor="end" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="tutors" name="Tutors" fill="hsl(var(--primary))" />
              <Bar dataKey="mentors" name="Mentors" fill="hsl(var(--muted-foreground))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team leader</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Tutors</TableHead>
                <TableHead className="text-right">Mentors</TableHead>
                <TableHead className="text-right">Full-time</TableHead>
                <TableHead className="text-right">Part-time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !rows.length ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No data</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.team_leader}>
                    <TableCell className="font-medium">{r.team_leader}</TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-right">{r.tutors}</TableCell>
                    <TableCell className="text-right">{r.mentors}</TableCell>
                    <TableCell className="text-right">{r.full_time}</TableCell>
                    <TableCell className="text-right">{r.part_time}</TableCell>
                  </TableRow>
                ))
              )}
              {rows.length > 0 && (
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{totals.total}</TableCell>
                  <TableCell className="text-right">{totals.tutors}</TableCell>
                  <TableCell className="text-right">{totals.mentors}</TableCell>
                  <TableCell className="text-right">{totals.full_time}</TableCell>
                  <TableCell className="text-right">{totals.part_time}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
