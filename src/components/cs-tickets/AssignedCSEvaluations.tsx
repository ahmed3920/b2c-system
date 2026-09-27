import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCSTickets, type CSTicket } from "./useCSTickets";
import { CSTicketDetailDialog } from "./CSTicketDetailDialog";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Pending: "secondary",
  Valid: "default",
  "Not Valid": "destructive",
  "Not a Complain": "outline",
  Validated: "default",
  Rejected: "destructive",
};

const isDecided = (t: CSTicket) => t.status !== "Pending" || !!t.closed_at;
const hasEvaluation = (t: CSTicket) => !!(t.mentor_evaluation_notes || t.mentor_recommendation);

export function AssignedCSEvaluations() {
  const { tickets, loading, refresh } = useCSTickets("assigned_to_me");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<CSTicket | null>(null);

  // Keep the open dialog in sync with refreshed data.
  useEffect(() => {
    if (!selected) return;
    const fresh = tickets.find((t) => t.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [tickets, selected]);

  const counts = useMemo(
    () => ({
      all: tickets.length,
      open: tickets.filter((t) => !isDecided(t)).length,
      closed: tickets.filter(isDecided).length,
    }),
    [tickets],
  );

  const filtered = useMemo(() => {
    let rows = tickets;
    if (filter === "open") rows = rows.filter((t) => !isDecided(t));
    if (filter === "closed") rows = rows.filter(isDecided);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.ticket_number.toLowerCase().includes(q) ||
          t.tutor_name.toLowerCase().includes(q) ||
          t.tutor_external_id.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [tickets, search, filter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assigned CS Evaluations</CardTitle>
        <p className="text-sm text-muted-foreground">
          {tickets.length} ticket(s) assigned to you for session review.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Search by ticket #, tutor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({counts.all})</SelectItem>
              <SelectItem value="open">Open ({counts.open})</SelectItem>
              <SelectItem value="closed">Closed ({counts.closed})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Tutor</TableHead>
                <TableHead>Team Leader</TableHead>
                <TableHead>Recordings</TableHead>
                <TableHead>Ticket Status</TableHead>
                <TableHead>Evaluation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No CS tickets assigned to you.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow key={t.id} onClick={() => setSelected(t)} className="cursor-pointer">
                    <TableCell className="font-mono text-xs">{t.ticket_number}</TableCell>
                    <TableCell>
                      {t.mentor_assigned_at ? format(new Date(t.mentor_assigned_at), "PP") : t.ticket_date}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{t.tutor_name}</span>
                        <span className="text-xs text-muted-foreground">{t.tutor_external_id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{t.team_leader}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.session_recordings.length}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[t.status] ?? "secondary"}>{t.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {hasEvaluation(t) ? (
                        <Badge variant="default">Submitted</Badge>
                      ) : isDecided(t) ? (
                        <Badge variant="outline">Closed by TL</Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <CSTicketDetailDialog
        ticket={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        onUpdated={refresh}
      />
    </Card>
  );
}
