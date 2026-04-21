import { useMemo, useState } from "react";
import { Plus, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CSTicketFormDialog } from "./CSTicketFormDialog";
import { CSTicketDetailDialog } from "./CSTicketDetailDialog";
import { useCSTickets, type CSTicket } from "./useCSTickets";
import type { CSTicketStatus } from "./csTicketCategories";

const statusVariant: Record<CSTicketStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Pending: "secondary",
  Validated: "default",
  Rejected: "destructive",
};

export function CSTicketsTable() {
  const { tickets, loading, refresh } = useCSTickets();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<CSTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [caseTypeFilter, setCaseTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (caseTypeFilter !== "all" && t.case_type !== caseTypeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !t.ticket_number.toLowerCase().includes(q) &&
          !t.tutor_name.toLowerCase().includes(q) &&
          !t.tutor_external_id.toLowerCase().includes(q) &&
          !t.category.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [tickets, statusFilter, caseTypeFilter, search]);

  const counts = useMemo(() => ({
    total: tickets.length,
    pending: tickets.filter((t) => t.status === "Pending").length,
    validated: tickets.filter((t) => t.status === "Validated").length,
    rejected: tickets.filter((t) => t.status === "Rejected").length,
  }), [tickets]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>CS Ticket Validation</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {counts.total} total · {counts.pending} pending · {counts.validated} validated · {counts.rejected} rejected
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Ticket
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by ticket #, tutor, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={caseTypeFilter} onValueChange={setCaseTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="mr-2 h-3 w-3" />
                <SelectValue placeholder="Case Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="CS">CS</SelectItem>
                <SelectItem value="Edu">Edu</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="mr-2 h-3 w-3" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Validated">Validated</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tutor</TableHead>
                <TableHead>Team Leader</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No tickets found</TableCell></TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow key={t.id} onClick={() => setSelected(t)} className="cursor-pointer">
                    <TableCell className="font-mono text-xs">{t.ticket_number}</TableCell>
                    <TableCell>{t.ticket_date}</TableCell>
                    <TableCell>
                      <Badge variant={t.case_type === "CS" ? "default" : "secondary"}>{t.case_type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{t.category}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{t.tutor_name}</span>
                        <span className="text-xs text-muted-foreground">{t.tutor_external_id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{t.team_leader}</TableCell>
                    <TableCell className="text-sm">{t.need_response_deadline ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[t.status]}>{t.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <CSTicketFormDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
      <CSTicketDetailDialog
        ticket={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        onUpdated={refresh}
      />
    </Card>
  );
}
