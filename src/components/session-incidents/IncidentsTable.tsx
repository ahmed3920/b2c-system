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
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [csFilter, setCsFilter] = useState<string>("all");
  const [active, setActive] = useState<SessionIncident | null>(null);

  const [tlFilter, setTlFilter] = useState<string>("all");
  const [mentorFilter, setMentorFilter] = useState<string>("all");
  const [tutorFilter, setTutorFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const canonName = (s: string | null | undefined) =>
    (s ?? "").replace(/\s+/g, " ").trim();

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((r) => r.case_category && set.add(r.case_category));
    return Array.from(set).sort();
  }, [items]);

  const teamLeaders = useMemo(() => {
    const set = new Set<string>();
    items.forEach((r) => {
      const tl = canonName(r.team_leader);
      if (tl) set.add(tl);
    });
    return Array.from(set).sort();
  }, [items]);

  const mentors = useMemo(() => {
    const set = new Set<string>();
    items.forEach((r) => {
      const m = canonName(r.assigned_mentor_name);
      if (m) set.add(m);
    });
    return Array.from(set).sort();
  }, [items]);

  const tutors = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((r) => {
      if (r.tutor_external_id) {
        map.set(r.tutor_external_id, `${r.tutor_external_id} · ${r.tutor_name || ""}`.trim());
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const filtered = useMemo(() => {
    let rows = items;
    if (pendingOnly) rows = rows.filter((r) => r.validation_status === "pending");
    if (statusFilter !== "all") rows = rows.filter((r) => r.validation_status === statusFilter);
    if (sourceFilter !== "all") rows = rows.filter((r) => r.source === sourceFilter);
    if (categoryFilter !== "all") rows = rows.filter((r) => r.case_category === categoryFilter);
    if (tlFilter !== "all") rows = rows.filter((r) => canonName(r.team_leader) === tlFilter);
    if (mentorFilter !== "all") rows = rows.filter((r) => canonName(r.assigned_mentor_name) === mentorFilter);
    if (tutorFilter !== "all") rows = rows.filter((r) => r.tutor_external_id === tutorFilter);
    if (dateFrom) rows = rows.filter((r) => (r.session_date || r.created_at.slice(0, 10)) >= dateFrom);
    if (dateTo) rows = rows.filter((r) => (r.session_date || r.created_at.slice(0, 10)) <= dateTo);
    if (csFilter !== "all") {
      rows = rows.filter((r) => {
        if (csFilter === "not_sent") return !r.sent_to_cs;
        if (csFilter === "sent") return r.sent_to_cs && r.cs_status !== "closed";
        if (csFilter === "closed") return r.sent_to_cs && r.cs_status === "closed";
        return true;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        [r.tutor_external_id, r.tutor_name, r.team_leader, r.student_id, r.student_name, r.case_category, r.case_description]
          .some((v) => (v || "").toLowerCase().includes(q))
      );
    }
    return rows;
  }, [items, search, statusFilter, sourceFilter, categoryFilter, csFilter, tlFilter, mentorFilter, tutorFilter, dateFrom, dateTo, pendingOnly]);

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
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={csFilter} onValueChange={setCsFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Sent to CS" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All CS</SelectItem>
                <SelectItem value="not_sent">Not sent</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tlFilter} onValueChange={setTlFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Team Leader" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">All team leaders</SelectItem>
                {teamLeaders.map((tl) => (
                  <SelectItem key={tl} value={tl}>{tl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={mentorFilter} onValueChange={setMentorFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Mentor" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">All mentors</SelectItem>
                {mentors.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tutorFilter} onValueChange={setTutorFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tutor" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">All tutors</SelectItem>
                {tutors.map(([id, label]) => (
                  <SelectItem key={id} value={id}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="tutor_self">Tutor self</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[150px]" title="From date" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[150px]" title="To date" />
            {(tlFilter !== "all" || mentorFilter !== "all" || tutorFilter !== "all" || categoryFilter !== "all" || sourceFilter !== "all" || csFilter !== "all" || dateFrom || dateTo || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTlFilter("all"); setMentorFilter("all"); setTutorFilter("all");
                  setCategoryFilter("all"); setSourceFilter("all"); setCsFilter("all");
                  setDateFrom(""); setDateTo(""); setSearch("");
                }}
              >
                Clear
              </Button>
            )}
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
                <TableHead>Sent to CS</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="h-20 text-center">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="h-20 text-center text-muted-foreground">No incidents.</TableCell></TableRow>
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
                  <TableCell>
                    {r.sent_to_cs ? (
                      r.cs_status === "closed" ? (
                        <Badge className="bg-gray-500/15 text-gray-700 hover:bg-gray-500/20">
                          Closed{r.cs_ticket_number ? ` · #${r.cs_ticket_number}` : ""}
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-500/15 text-blue-700 hover:bg-blue-500/20">
                          Sent{r.cs_ticket_number ? ` · #${r.cs_ticket_number}` : ""}
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Not sent</Badge>
                    )}
                  </TableCell>
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
