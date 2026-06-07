import { useState } from "react";
import { CmsLayout } from "@/components/cms/CmsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Pencil } from "lucide-react";
import { useCmsUsers, type CmsUser } from "@/hooks/useCmsUsers";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { JOB_TITLES, tierForTitle, type CmsJobTitle } from "@/lib/cmsJobTitles";

export default function CmsUsers() {
  const { users, loading, refresh, setActive, setTitle } = useCmsUsers();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [title, setTitleVal] = useState<CmsJobTitle>("developer");

  // Edit dialog state
  const [editing, setEditing] = useState<CmsUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editTitle, setEditTitle] = useState<CmsJobTitle>("developer");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      toast({ title: "Invalid input", description: "Name, email, and password (8+ chars) required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const tier = tierForTitle(title);
    const { data, error } = await supabase.functions.invoke("cms-admin-create-user", {
      body: { fullName: fullName.trim(), email: email.trim(), password, role: tier, title },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast({ title: "Failed", description: (data as any)?.error ?? error?.message, variant: "destructive" });
      return;
    }
    if (data && typeof data === "object" && "userId" in (data as Record<string, unknown>)) {
      const userId = (data as { userId?: string }).userId;
      if (userId) await setTitle(userId, title);
    }
    toast({ title: "User created" });
    setOpen(false);
    setFullName(""); setEmail(""); setPassword(""); setTitleVal("developer");
    refresh();
  };

  const openEdit = (u: CmsUser) => {
    setEditing(u);
    setEditName(u.full_name ?? "");
    setEditEmail(u.email ?? "");
    setEditPassword("");
    setEditTitle((u.title ?? "developer") as CmsJobTitle);
  };

  const handleEdit = async () => {
    if (!editing) return;
    if (editPassword && editPassword.length < 8) {
      toast({ title: "Invalid password", description: "Password must be 8+ characters.", variant: "destructive" });
      return;
    }
    setEditSubmitting(true);
    const tier = tierForTitle(editTitle);
    const body: Record<string, unknown> = {
      userId: editing.user_id,
      fullName: editName.trim(),
      role: tier,
      title: editTitle,
    };
    if (editEmail && editEmail.trim().toLowerCase() !== (editing.email ?? "").toLowerCase()) {
      body.email = editEmail.trim();
    }
    if (editPassword) body.password = editPassword;

    const { data, error } = await supabase.functions.invoke("cms-admin-update-user", { body });
    setEditSubmitting(false);
    if (error || (data as any)?.error) {
      toast({ title: "Failed", description: (data as any)?.error ?? error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "User updated" });
    setEditing(null);
    refresh();
  };

  return (
    <CmsLayout title="Users" allowedRoles={["cms_admin"]}>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" />New CMS user</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create CMS user</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <div>
                  <Label>Job title</Label>
                  <Select value={title} onValueChange={(v) => setTitleVal(v as CmsJobTitle)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{JOB_TITLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle>CMS users ({users.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Job title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-[80px]">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No CMS users yet</TableCell></TableRow>
                ) : users.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell>{u.email ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={u.title ?? "developer"} onValueChange={(v) => setTitle(u.user_id, v as CmsJobTitle)}>
                        <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{JOB_TITLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.active_status ? "default" : "secondary"}>
                        {u.active_status ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={u.active_status} onCheckedChange={(v) => setActive(u.user_id, v)} />
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(u)} aria-label="Edit user">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit CMS user</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div><Label>Full name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                </div>
                <div>
                  <Label>New password</Label>
                  <Input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                  />
                </div>
                <div>
                  <Label>Job title</Label>
                  <Select value={editTitle} onValueChange={(v) => setEditTitle(v as CmsJobTitle)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{JOB_TITLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleEdit} disabled={editSubmitting}>
                {editSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CmsLayout>
  );
}
