import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useProjectAuditAccessList } from "@/hooks/useProjectAuditAccess";
import { SearchableSelect } from "@/components/tracking/quality/QualityFilterBar";

export function ProjectAccessDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { rows, grant, revoke } = useProjectAuditAccessList(open);
  const [people, setPeople] = useState<{ user_id: string; full_name: string | null; email: string | null }[]>([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (!open) return;
    supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .order("full_name")
      .then(({ data }) => setPeople(data ?? []));
  }, [open]);

  const add = async () => {
    if (!selected) return;
    try {
      await grant(selected);
      setSelected("");
      toast({ title: "Access granted" });
    } catch (e) {
      toast({
        title: "Could not grant access",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldCheck className="h-4 w-4 mr-1" />
          Manage access
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Projects audit access</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Admins always have access. Add anyone else who should see the Projects area.
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <SearchableSelect
              value={selected}
              onChange={setSelected}
              options={people
                .filter((p) => !rows.some((r) => r.user_id === p.user_id))
                .map((p) => p.user_id)}
              allLabel="Choose a person"
              placeholder="Choose a person"
              labelFn={(id) => {
                const p = people.find((x) => x.user_id === id);
                return p?.full_name || p?.email || id;
              }}
            />
          </div>
          <Button onClick={add} disabled={!selected}>
            Add
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Added</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.full_name || r.email || r.user_id}</TableCell>
                <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => revoke(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                  No extra people yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
