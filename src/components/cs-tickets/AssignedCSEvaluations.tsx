import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCSTickets, type CSTicket } from "./useCSTickets";
import { CSTicketDetailDialog } from "./CSTicketDetailDialog";

export function AssignedCSEvaluations() {
  const { tickets, loading, refresh } = useCSTickets("assigned_to_me");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CSTicket | null>(null);

  const filtered = useMemo(() => {
    if (!search) return tickets;
    const q = search.toLowerCase();
    return tickets.filter(
      (t) =>
        t.ticket_number.toLowerCase().includes(q) ||
        t.tutor_name.toLowerCase().includes(q) ||
        t.tutor_external_id.toLowerCase().includes(q),
    );
  }, [tickets, search]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assigned CS Evaluations</CardTitle>
        <p className="text-sm text-muted-foreground">
          {tickets.length} ticket(s) assigned to you for session review.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Search by ticket #, tutor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Tutor</TableHead>
                <TableHead>Team Leader</TableHead>
                <TableHead>Recordings</TableHead>
                <TableHead>Evaluation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                      {t.mentor_evaluation_notes || t.mentor_recommendation ? (
                        <Badge variant="default">Submitted</Badge>
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
