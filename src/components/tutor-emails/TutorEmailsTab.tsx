import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Pencil, Upload, Mail } from "lucide-react";
import { format } from "date-fns";
import { useTutorEmails, type TutorEmail } from "@/hooks/useTutorEmails";
import { useActionPlanTutors } from "@/hooks/useActionPlans";
import { TutorEmailDialog } from "./TutorEmailDialog";
import { TutorEmailsBulkImport } from "./TutorEmailsBulkImport";

export function TutorEmailsTab() {
  const { emails, isLoading, refetch } = useTutorEmails();
  const { tutors } = useActionPlanTutors();
  const tlByExternalId = useMemo(() => {
    const m = new Map<string, string>();
    tutors.forEach((t) => {
      if (t.tutor_external_id) m.set(t.tutor_external_id, t.team_leader);
    });
    return m;
  }, [tutors]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TutorEmail | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    return emails.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.tutor_name.toLowerCase().includes(q) &&
          !e.tutor_external_id.toLowerCase().includes(q) &&
          !e.email.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [emails, search, statusFilter]);

  const activeCount = emails.filter((e) => e.status === "active").length;
  const inactiveCount = emails.length - activeCount;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="w-4 h-4 text-primary" />
          <span><strong>{emails.length}</strong> total</span>
          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
            {activeCount} active
          </Badge>
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            {inactiveCount} inactive
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Bulk Import
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Email
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, ID or email..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tutor ID</TableHead>
                <TableHead>Tutor Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Team Leader</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No emails found</TableCell></TableRow>
              ) : (
                filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.tutor_external_id}</TableCell>
                    <TableCell className="font-medium">{e.tutor_name}</TableCell>
                    <TableCell><a href={`mailto:${e.email}`} className="text-primary hover:underline">{e.email}</a></TableCell>
                    <TableCell className="text-sm">{tlByExternalId.get(e.tutor_external_id) || e.team_leader || "—"}</TableCell>
                    <TableCell>
                      {e.status === "active" ? (
                        <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/20 border-green-500/30">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(e.updated_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(e); setDialogOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TutorEmailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        record={editing}
        onSaved={refetch}
      />
      <TutorEmailsBulkImport
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={refetch}
      />
    </div>
  );
}
