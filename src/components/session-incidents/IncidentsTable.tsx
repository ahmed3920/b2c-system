import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ExternalLink } from "lucide-react";
import { ValidationDialog } from "./ValidationDialog";
import type { SessionIncident } from "@/hooks/useSessionIncidents";

interface Props {
  items: SessionIncident[];
  loading: boolean;
  onChanged: () => void;
  pendingOnly?: boolean;
  canValidate?: boolean;
  title?: string;
}

export function IncidentsTable({ items, loading, onChanged, pendingOnly, canValidate, title }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [active, setActive] = useState<SessionIncident | null>(null);

  const filtered = useMemo(() => {
    let rows = items;
    if (pendingOnly) rows = rows.filter((r) => r.validation_status === "pending");
    if (statusFilter !== "all") rows = rows.filter((r) => r.validation_status === statusFilter);
    if (sourceFilter !== "all") rows = rows.filter((r) => r.source === sourceFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        [r.tutor_external_id, r.tutor_name, r.team_leader, r.student_id, r.student_name, r.case_category, r.case_description]
          .some((v) => (v || "").toLowerCase().includes(q))
      );
    }
    return rows;
  }, [items, search, statusFilter, sourceFilter, pendingOnly]);

  const statusBadge = (s: string) => {
    if (s === "approved") return <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/20">Approved</Badge>;
    if (s === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    return <Badge variant="secondary">Pending</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle>{title ?? "Session Incidents"}</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-8 w-[220px]" />
            </div>
            {!pendingOnly && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="tutor_self">Tutor self</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tutor</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="h-20 text-center">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-20 text-center text-muted-foreground">No incidents.</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setActive(r)}>
                  <TableCell>
                    <div className="font-medium">{r.tutor_name}</div>
                    <div className="text-xs text-muted-foreground">{r.tutor_external_id} · {r.team_leader}</div>
                  </TableCell>
                  <TableCell>
                    {r.student_name || r.student_id ? (
                      <div>
                        <div>{r.student_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.student_id} {r.student_grade ? `· ${r.student_grade}` : ""}</div>
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <div>{r.session_number || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.session_date || ""}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.case_category}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={r.source === "tutor_self" ? "secondary" : "outline"}>
                      {r.source === "tutor_self" ? "Tutor" : "Staff"}
                    </Badge>
                  </TableCell>
                  <TableCell>{statusBadge(r.validation_status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "PP")}</TableCell>
                  <TableCell>
                    {r.supporting_link && (
                      <a href={r.supporting_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {active && (
        <ValidationDialog
          incident={active}
          open={!!active}
          onOpenChange={(v) => !v && setActive(null)}
          canValidate={canValidate}
          onChanged={() => { onChanged(); setActive(null); }}
        />
      )}
    </Card>
  );
}
