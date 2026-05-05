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
import { Plus, Loader2 } from "lucide-react";
import { useCmsUsers } from "@/hooks/useCmsUsers";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { JOB_TITLES, jobTitleLabel, tierForTitle, type CmsJobTitle } from "@/lib/cmsJobTitles";

export default function CmsUsers() {
  const { users, loading, refresh, setActive, setTitle } = useCmsUsers();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [title, setTitleVal] = useState<CmsJobTitle>("developer");

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
    // Ensure title is stored even if the edge function ignores it.
    if (data && typeof data === "object" && "userId" in (data as Record<string, unknown>)) {
      const userId = (data as { userId?: string }).userId;
      if (userId) await setTitle(userId, title);
    }
    toast({ title: "User created" });
    setOpen(false);
    setFullName(""); setEmail(""); setPassword(""); setTitleVal("developer");
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5}>Loading…</TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No CMS users yet</TableCell></TableRow>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </CmsLayout>
  );
}
