import { useEffect, useState } from "react";
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
import { useEduDescriptions, type EduDescription, type EduDescriptionType } from "@/hooks/useEduDescriptions";

const TYPE_LABELS: Record<EduDescriptionType, string> = {
  deduction: "Deduction",
  no_deduction: "No Deduction",
  neutral: "Neutral",
};

const DEFAULT_COLORS: Record<EduDescriptionType, string> = {
  deduction: "#ef4444",
  no_deduction: "#10b981",
  neutral: "#f59e0b",
};

interface FormState {
  id?: string;
  name: string;
  type: EduDescriptionType;
  color: string;
  is_active: boolean;
  display_order: number;
}

const empty: FormState = { name: "", type: "neutral", color: DEFAULT_COLORS.neutral, is_active: true, display_order: 0 };

export default function EduDescriptionsAdmin() {
  const { items, loading, reload } = useEduDescriptions(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (d: EduDescription) => {
    setForm({
      id: d.id, name: d.name, type: d.type, color: d.color,
      is_active: d.is_active, display_order: d.display_order,
    });
    setOpen(true);
  };

  // When type changes, suggest the default color if user hasn't customized
  useEffect(() => {
    setForm((f) => {
      if (Object.values(DEFAULT_COLORS).includes(f.color)) {
        return { ...f, color: DEFAULT_COLORS[f.type] };
      }
      return f;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type]);

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      color: form.color,
      is_active: form.is_active,
      display_order: form.display_order,
    };
    const { error } = form.id
      ? await supabase.from("edu_descriptions").update(payload).eq("id", form.id)
      : await supabase.from("edu_descriptions").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Updated" : "Created");
    setOpen(false);
    reload();
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("edu_descriptions").delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    setDeleteId(null);
    reload();
  };

  return (
    <AppLayout title="Edu Description Management" allowedRoles={["admin"]}>
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Edu Descriptions</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Reasons used by Education team when validating live session issues.
                Type controls auto-validation: <b>Deduction</b> sets validation to Deduct,
                <b> No Deduction</b> to No Deduction, <b>Neutral</b> leaves validation unchanged.
              </p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew}><Plus className="h-4 w-4" /> New description</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{form.id ? "Edit description" : "New description"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as EduDescriptionType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deduction">Deduction</SelectItem>
                        <SelectItem value="no_deduction">No Deduction</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Color</Label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={form.color}
                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                        className="h-10 w-14 rounded border" />
                      <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Display order</Label>
                    <Input type="number" value={form.display_order}
                      onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="flex items-center justify-between border rounded-md p-3">
                    <div>
                      <div className="text-sm font-medium">Active</div>
                      <div className="text-xs text-muted-foreground">Inactive items are hidden from the validation dropdown.</div>
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
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="h-20 text-center">Loading…</TableCell></TableRow>
                  ) : items.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">No descriptions yet.</TableCell></TableRow>
                  ) : items.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                          {d.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{TYPE_LABELS[d.type]}</Badge>
                      </TableCell>
                      <TableCell><span className="font-mono text-xs">{d.color}</span></TableCell>
                      <TableCell>{d.display_order}</TableCell>
                      <TableCell>{d.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
            <AlertDialogTitle>Delete description?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the description. Existing cases that use it will have their description cleared but keep their validation.
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
