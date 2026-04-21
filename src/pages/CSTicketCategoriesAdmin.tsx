import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCSTicketCategories, type CSTicketCategory } from "@/components/cs-tickets/useCSTicketCategories";
import type { CSTicketCaseType } from "@/components/cs-tickets/csTicketCategories";

interface FormState {
  id?: string;
  case_type: CSTicketCaseType;
  name: string;
  display_order: number;
  is_active: boolean;
}

const empty: FormState = { case_type: "CS", name: "", display_order: 0, is_active: true };

export default function CSTicketCategoriesAdmin() {
  const { items, loading, reload } = useCSTicketCategories(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | CSTicketCaseType>("all");

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (c: CSTicketCategory) => {
    setForm({
      id: c.id, case_type: c.case_type, name: c.name,
      display_order: c.display_order, is_active: c.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload = {
      case_type: form.case_type,
      name: form.name.trim(),
      display_order: form.display_order,
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await supabase.from("cs_ticket_categories").update(payload).eq("id", form.id)
      : await supabase.from("cs_ticket_categories").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Updated" : "Created");
    setOpen(false);
    reload();
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("cs_ticket_categories").delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    setDeleteId(null);
    reload();
  };

  const filtered = filter === "all" ? items : items.filter((c) => c.case_type === filter);

  return (
    <AppLayout title="CS Ticket Categories" allowedRoles={["admin"]}>
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>CS Ticket Categories</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage the categories that appear in the CS Ticket form for each case type.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CS">CS</SelectItem>
                  <SelectItem value="Edu">Edu</SelectItem>
                </SelectContent>
              </Select>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNew}><Plus className="h-4 w-4" /> New category</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{form.id ? "Edit category" : "New category"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Case Type</Label>
                      <Select value={form.case_type} onValueChange={(v) => setForm({ ...form, case_type: v as CSTicketCaseType })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CS">CS</SelectItem>
                          <SelectItem value="Edu">Edu</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Name</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Display order</Label>
                      <Input type="number" value={form.display_order}
                        onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="flex items-center justify-between border rounded-md p-3">
                      <div>
                        <div className="text-sm font-medium">Active</div>
                        <div className="text-xs text-muted-foreground">Inactive categories are hidden from the ticket form.</div>
                      </div>
                      <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="h-20 text-center">Loading…</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No categories yet.</TableCell></TableRow>
                  ) : filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Badge variant={c.case_type === "CS" ? "default" : "secondary"}>{c.case_type}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.display_order}</TableCell>
                      <TableCell>{c.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the category from the form. Existing tickets keep their stored category text.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
