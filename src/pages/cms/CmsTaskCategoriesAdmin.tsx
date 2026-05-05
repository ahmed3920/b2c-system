import { useState } from "react";
import { CmsLayout } from "@/components/cms/CmsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useCmsTaskCategories, type CmsTaskCategory } from "@/hooks/useCmsTaskCategories";
import { useCmsRole } from "@/hooks/useCmsRole";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";

export default function CmsTaskCategoriesAdmin() {
  const { isCmsAdmin, loading: roleLoading } = useCmsRole();
  const { categories, create, update, remove } = useCmsTaskCategories(true);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CmsTaskCategory | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [order, setOrder] = useState(0);
  const [active, setActive] = useState(true);

  if (!roleLoading && !isCmsAdmin) return <Navigate to="/cms/tasks" replace />;

  const openNew = () => {
    setEditing(null); setName(""); setColor("#3b82f6");
    setOrder(categories.length); setActive(true); setOpen(true);
  };

  const openEdit = (c: CmsTaskCategory) => {
    setEditing(c); setName(c.name); setColor(c.color);
    setOrder(c.display_order); setActive(c.is_active); setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    const payload = { name: name.trim(), color, display_order: order, is_active: active };
    const res = editing ? await update(editing.id, payload) : await create(payload);
    if (!res.ok) toast({ title: "Failed", description: res.error, variant: "destructive" });
    else { toast({ title: editing ? "Category updated" : "Category created" }); setOpen(false); }
  };

  return (
    <CmsLayout title="Task Categories">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Categories for content team tasks (Article, Video, Social Post, etc.)
          </p>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />New category</Button>
        </div>

        <Card>
          <CardHeader><CardTitle>Categories ({categories.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No categories</TableCell></TableRow>
                ) : categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
                        {c.name}
                      </span>
                    </TableCell>
                    <TableCell><code className="text-xs">{c.color}</code></TableCell>
                    <TableCell>{c.display_order}</TableCell>
                    <TableCell>{c.is_active ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Color</Label>
                <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" />
              </div>
              <div>
                <Label>Display order</Label>
                <Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} id="cat-active" />
              <Label htmlFor="cat-active">Active</Label>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Save" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </CmsLayout>
  );
}
