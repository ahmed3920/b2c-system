import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTeamLeaderEmails, type TeamLeaderEmail } from "@/hooks/useTeamLeaderEmails";

export function TeamLeaderEmailsTab() {
  const { items, isLoading, refetch } = useTeamLeaderEmails();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamLeaderEmail | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing(null);
    setName(""); setEmail(""); setActive(true); setNotes("");
    setOpen(true);
  };
  const openEdit = (rec: TeamLeaderEmail) => {
    setEditing(rec);
    setName(rec.team_leader_name);
    setEmail(rec.email);
    setActive(rec.is_active);
    setNotes(rec.notes ?? "");
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    const payload = {
      team_leader_name: name.trim(),
      email: email.trim().toLowerCase(),
      is_active: active,
      notes: notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("team_leader_emails").update(payload).eq("id", editing.id)
      : await supabase.from("team_leader_emails").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Failed to save", { description: error.message });
      return;
    }
    toast.success("Saved");
    setOpen(false);
    refetch();
  };

  const remove = async (rec: TeamLeaderEmail) => {
    if (!confirm(`Remove email mapping for ${rec.team_leader_name}?`)) return;
    const { error } = await supabase.from("team_leader_emails").delete().eq("id", rec.id);
    if (error) {
      toast.error("Failed to delete", { description: error.message });
      return;
    }
    toast.success("Removed");
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <UserCog className="w-4 h-4 text-primary" />
          <strong>{items.length}</strong> Team Leader emails
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" /> Add Team Leader Email
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Emails sent from Action Plans use the Team Leader's address as <strong>Reply-To</strong>,
        so tutor replies go directly to the Team Leader.
      </p>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Leader</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No team leader emails configured</TableCell></TableRow>
              ) : (
                items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.team_leader_name}</TableCell>
                    <TableCell>
                      <a href={`mailto:${r.email}`} className="text-primary hover:underline">{r.email}</a>
                    </TableCell>
                    <TableCell>
                      {r.is_active ? (
                        <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/20 border-green-500/30">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.notes ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => remove(r)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Add"} Team Leader Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Team Leader Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Exact mentor_name as in profiles" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="leader@yourdomain.com" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} id="tle-active" />
              <Label htmlFor="tle-active" className="cursor-pointer">Active</Label>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
