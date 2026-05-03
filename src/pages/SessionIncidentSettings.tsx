import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSessionIncidentCategories, useIncidentFieldConfig, type IncidentCategory } from "@/hooks/useSessionIncidentConfig";

export default function SessionIncidentSettings() {
  return (
    <AppLayout title="Session Incident Settings" allowedRoles={["admin"]}>
      <div className="p-6 max-w-5xl mx-auto">
        <Tabs defaultValue="fields">
          <TabsList>
            <TabsTrigger value="fields">Field Requirements</TabsTrigger>
            <TabsTrigger value="categories">Case Categories</TabsTrigger>
          </TabsList>
          <TabsContent value="fields" className="mt-4"><FieldsTab /></TabsContent>
          <TabsContent value="categories" className="mt-4"><CategoriesTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function FieldsTab() {
  const { items, loading, reload } = useIncidentFieldConfig();
  const update = async (id: string, patch: Partial<{ is_required: boolean; is_visible: boolean }>) => {
    const { error } = await supabase.from("session_incident_field_config").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    reload();
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Field Requirements</CardTitle>
        <p className="text-sm text-muted-foreground">Toggle which fields are visible and required on the incident form.</p>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead className="text-center">Visible</TableHead>
                <TableHead className="text-center">Required</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="h-20 text-center">Loading…</TableCell></TableRow>
              ) : items.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">
                    {f.field_label}
                    {f.is_locked && <Badge variant="outline" className="ml-2 text-xs">Locked</Badge>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={f.is_visible}
                      disabled={f.is_locked}
                      onCheckedChange={(v) => update(f.id, { is_visible: v })}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={f.is_required}
                      disabled={f.is_locked}
                      onCheckedChange={(v) => update(f.id, { is_required: v })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

interface CatForm { id?: string; name: string; display_order: number; is_active: boolean; }
const empty: CatForm = { name: "", display_order: 0, is_active: true };

function CategoriesTab() {
  const { items, loading, reload } = useSessionIncidentCategories(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CatForm>(empty);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (c: IncidentCategory) => { setForm({ id: c.id, name: c.name, display_order: c.display_order, is_active: c.is_active }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), display_order: form.display_order, is_active: form.is_active };
    const { error } = form.id
      ? await supabase.from("session_incident_categories").update(payload).eq("id", form.id)
      : await supabase.from("session_incident_categories").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Updated" : "Created");
    setOpen(false); reload();
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("session_incident_categories").delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); setDeleteId(null); reload();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Case Categories</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Categories shown in the incident form's dropdown.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New category</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Display order</Label><Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} /></div>
              <div className="flex items-center justify-between border rounded-md p-3">
                <div><div className="text-sm font-medium">Active</div><div className="text-xs text-muted-foreground">Inactive categories are hidden from the form.</div></div>
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
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Order</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="h-20 text-center">Loading…</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No categories.</TableCell></TableRow>
              ) : items.map((c) => (
                <TableRow key={c.id}>
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
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete category?</AlertDialogTitle><AlertDialogDescription>This removes it from the form. Existing incidents keep their stored category text.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
