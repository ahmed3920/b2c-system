import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CSTicketFormDialog } from "./CSTicketFormDialog";
import { CSTicketDetailDialog } from "./CSTicketDetailDialog";
import { useCSTickets, type CSTicket, type CSTicketScope } from "./useCSTickets";
import type { CSTicketStatus } from "./csTicketCategories";
import { useUserRole } from "@/hooks/useUserRole";
import { useCsFullAccess } from "@/hooks/useCsFullAccess";
import { getMentorForTutor } from "@/lib/tutorMentorLookup";
import { UserCheck } from "lucide-react";

const statusVariant: Record<CSTicketStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Pending: "secondary",
  Valid: "default",
  "Not Valid": "destructive",
  "Not a Complain": "outline",
  Validated: "default",
  Rejected: "destructive",
};

export function CSTicketsTable() {
  const { isAdmin, isSuperTeamLeader } = useUserRole();
  const { hasAccess: csFullAccess } = useCsFullAccess();
  const canCreate = isAdmin || isSuperTeamLeader || csFullAccess;

  // Scope is the source of truth — passed to the hook so the database
  // performs all team-leader matching. No client-side name matching.
  const [scope, setScope] = useState<CSTicketScope>("all");
  const { tickets, loading, refresh } = useCSTickets(scope);

  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<CSTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [caseTypeFilter, setCaseTypeFilter] = useState<string>("all");
  const [teamLeaderFilter, setTeamLeaderFilter] = useState<string>("all");
  const [quickFilter, setQuickFilter] = useState<"all" | "due_today" | "not_validated">("all");
  const [search, setSearch] = useState("");

  const isSameDay = (iso: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  const teamLeaders = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach((t) => { if (t.team_leader) set.add(t.team_leader); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (caseTypeFilter !== "all" && !t.case_types.includes(caseTypeFilter as any)) return false;
      if (teamLeaderFilter !== "all" && t.team_leader !== teamLeaderFilter) return false;
      if (quickFilter === "due_today" && !isSameDay(t.need_response_deadline)) return false;
      if (quickFilter === "not_validated" && !(t.status === "Pending")) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !t.ticket_number.toLowerCase().includes(q) &&
          !t.tutor_name.toLowerCase().includes(q) &&
          !t.tutor_external_id.toLowerCase().includes(q) &&
          !(t.cs_category ?? "").toLowerCase().includes(q) &&
          !(t.edu_category ?? "").toLowerCase().includes(q) &&
          !t.category.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [tickets, statusFilter, caseTypeFilter, teamLeaderFilter, quickFilter, search]);


  const counts = useMemo(() => ({
    total: tickets.length,
    pending: tickets.filter((t) => t.status === "Pending").length,
    valid: tickets.filter((t) => t.status === "Valid" || t.status === "Validated").length,
    notValid: tickets.filter((t) => t.status === "Not Valid" || t.status === "Rejected").length,
    dueToday: tickets.filter((t) => isSameDay(t.need_response_deadline)).length,
    notValidated: tickets.filter((t) => t.status === "Pending").length,
  }), [tickets]);

  const renderTable = () => (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={quickFilter === "all" ? "default" : "outline"}
          onClick={() => setQuickFilter("all")}
        >
          All ({counts.total})
        </Button>
        <Button
          size="sm"
          variant={quickFilter === "due_today" ? "default" : "outline"}
          onClick={() => setQuickFilter(quickFilter === "due_today" ? "all" : "due_today")}
        >
          Due Today ({counts.dueToday})
        </Button>
        <Button
          size="sm"
          variant={quickFilter === "not_validated" ? "default" : "outline"}
          onClick={() => setQuickFilter(quickFilter === "not_validated" ? "all" : "not_validated")}
        >
          Not Validated ({counts.notValidated})
        </Button>
      </div>

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
              <SelectItem value="Valid">Valid</SelectItem>
              <SelectItem value="Not Valid">Not Valid</SelectItem>
              <SelectItem value="Not a Complain">Not a Complain</SelectItem>
            </SelectContent>
          </Select>
          <Select value={teamLeaderFilter} onValueChange={setTeamLeaderFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-3 w-3" />
              <SelectValue placeholder="Team Leader" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Team Leaders</SelectItem>
              {teamLeaders.map((tl) => (
                <SelectItem key={tl} value={tl}>{tl}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>CS Category</TableHead>
              <TableHead>Edu Category</TableHead>
              <TableHead>Tutor</TableHead>
              <TableHead>Team Leader</TableHead>
              <TableHead>Mentor</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No tickets found</TableCell></TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.id} onClick={() => setSelected(t)} className="cursor-pointer">
                  <TableCell className="font-mono text-xs">{t.ticket_number}</TableCell>
                  <TableCell>{t.ticket_date}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {t.cs_category || (t.case_types.includes("CS") ? t.category : "—")}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {t.edu_category || (t.case_types.includes("Edu") ? t.category : "—")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{t.tutor_name}</span>
                      <span className="text-xs text-muted-foreground">{t.tutor_external_id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{t.team_leader}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-col">
                      <span>{getMentorForTutor(t.tutor_external_id)}</span>
                      {t.assigned_mentor_id && (
                        <span className="text-xs text-primary inline-flex items-center gap-1">
                          <UserCheck className="h-3 w-3" /> Eval: {t.assigned_mentor_name}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.need_response_deadline ? format(new Date(t.need_response_deadline), "PP p") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[t.status]}>{t.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>CS Ticket Validation</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {counts.total} total · {counts.pending} pending · {counts.valid} valid · {counts.notValid} not valid
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Ticket
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isSuperTeamLeader ? (
          <Tabs value={scope} onValueChange={(v) => setScope(v as CSTicketScope)}>
            <TabsList>
              <TabsTrigger value="all">All Tickets</TabsTrigger>
              <TabsTrigger value="mine">My Team's Tickets</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4">{renderTable()}</TabsContent>
            <TabsContent value="mine" className="mt-4">{renderTable()}</TabsContent>
          </Tabs>
        ) : (
          renderTable()
        )}
      </CardContent>

      {canCreate && (
        <CSTicketFormDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
      )}
      <CSTicketDetailDialog
        ticket={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        onUpdated={refresh}
      />
    </Card>
  );
}
