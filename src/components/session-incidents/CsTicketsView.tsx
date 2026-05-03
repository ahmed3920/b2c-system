import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { ValidationDialog } from "./ValidationDialog";
import type { SessionIncident } from "@/hooks/useSessionIncidents";

interface Props {
  items: SessionIncident[];
  loading: boolean;
  onChanged: () => void;
}

export function CsTicketsView({ items, loading, onChanged }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all | open | closed
  const [active, setActive] = useState<SessionIncident | null>(null);

  const filtered = useMemo(() => {
    let rows = items.filter((r) => r.sent_to_cs);
    if (statusFilter === "open") rows = rows.filter((r) => r.cs_status !== "closed");
    if (statusFilter === "closed") rows = rows.filter((r) => r.cs_status === "closed");
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        [r.cs_ticket_number, r.tutor_external_id, r.tutor_name, r.team_leader, r.student_id, r.student_name, r.case_category, r.cs_response]
          .some((v) => (v || "").toLowerCase().includes(q))
      );
    }
    return rows;
  }, [items, search, statusFilter]);

  const counts = useMemo(() => {
    const sent = items.filter((r) => r.sent_to_cs);
    return {
      all: sent.length,
      open: sent.filter((r) => r.cs_status !== "closed").length,
      closed: sent.filter((r) => r.cs_status === "closed").length,
    };
  }, [items]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle>CS Tickets</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ticket / tutor / student..." className="pl-8 w-[260px]" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sent to CS ({counts.all})</SelectItem>
                <SelectItem value="open">Open ({counts.open})</SelectItem>
                <SelectItem value="closed">Closed ({counts.closed})</SelectItem>
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
                <TableHead>CS Ticket #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tutor</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>CS Response</TableHead>
                <TableHead>Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="h-20 text-center">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-20 text-center text-muted-foreground">No CS tickets.</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setActive(r)}>
                  <TableCell className="font-mono">{r.cs_ticket_number || "—"}</TableCell>
                  <TableCell>
                    {r.cs_status === "closed" ? (
                      <Badge className="bg-gray-500/15 text-gray-700">Closed</Badge>
                    ) : (
                      <Badge className="bg-blue-500/15 text-blue-700">Open</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.tutor_name}</div>
                    <div className="text-xs text-muted-foreground">{r.tutor_external_id} · {r.team_leader}</div>
                  </TableCell>
                  <TableCell>
                    {r.student_name || r.student_id ? (
                      <div>
                        <div>{r.student_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.student_id}</div>
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell><Badge variant="outline">{r.case_category}</Badge></TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                    {r.cs_response || (r.cs_status === "closed" ? "—" : "Awaiting reply")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(r.updated_at), "PP")}
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
          canValidate
          onChanged={() => { onChanged(); setActive(null); }}
        />
      )}
    </Card>
  );
}
