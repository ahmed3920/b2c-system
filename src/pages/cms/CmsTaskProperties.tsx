import { useState } from "react";
import { CmsLayout } from "@/components/cms/CmsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useCmsPropertyDefs,
  type CmsPropertyDef,
  type CmsPropType,
  type CmsPropOption,
} from "@/hooks/useCmsTaskProperties";

const TYPES: { value: CmsPropType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "url", label: "URL" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "percent", label: "Percent" },
  { value: "select", label: "Select" },
  { value: "multi_select", label: "Multi-select" },
  { value: "person", label: "Person" },
];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export default function CmsTaskProperties() {
  const { defs, loading, create, update, remove } = useCmsPropertyDefs();
  const { toast } = useToast();
  const [editing, setEditing] = useState<CmsPropertyDef | null>(null);
  const [open, setOpen] = useState(false);

  const startNew = () => {
    setEditing({
      id: "",
      key: "",
      label: "",
      type: "text",
      options: [],
      display_order: (defs[defs.length - 1]?.display_order ?? 0) + 10,
      is_active: true,
      created_at: "",
      updated_at: "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.label.trim()) {
      toast({ title: "Label required", variant: "destructive" });
      return;
    }
    const key = editing.key || slugify(editing.label);
    if (!editing.id) {
      const res = await create({
        key, label: editing.label, type: editing.type,
        options: editing.options, display_order: editing.display_order,
        is_active: editing.is_active,
      });
      if (!res.ok) { toast({ title: "Failed", description: res.error, variant: "destructive" }); return; }
      toast({ title: "Property created" });
    } else {
      const res = await update(editing.id, {
        label: editing.label, type: editing.type,
        options: editing.options, display_order: editing.display_order,
        is_active: editing.is_active,
      });
      if (!res.ok) { toast({ title: "Failed", description: res.error, variant: "destructive" }); return; }
      toast({ title: "Property updated" });
    }
    setOpen(false);
    setEditing(null);
  };

  const handleDelete = async (def: CmsPropertyDef) => {
    if (!confirm(`Delete property "${def.label}"? Existing values will be removed.`)) return;
    const res = await remove(def.id);
    if (!res.ok) toast({ title: "Failed", description: res.error, variant: "destructive" });
    else toast({ title: "Property deleted" });
  };

  const supportsOptions = editing?.type === "select" || editing?.type === "multi_select";

  return (
    <CmsLayout title="Task Properties" allowedRoles={["cms_admin"]}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Define the custom property fields shown on every task. Members fill them in; admins manage them globally.
          </p>
          <Button onClick={startNew}><Plus className="w-4 h-4 mr-1" />New property</Button>
        </div>

        <Card>
          <CardHeader><CardTitle>Properties ({defs.length})</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : defs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No properties yet.</p>
            ) : (
              <div className="divide-y">
                {defs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{d.label}</span>
                        <Badge variant="secondary" className="text-xs">{d.type}</Badge>
                        {!d.is_active && <Badge variant="outline" className="text-xs">Hidden</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        key: <code>{d.key}</code> · order {d.display_order}
                        {d.options.length > 0 && ` · ${d.options.length} options`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(d); setOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(d)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} property</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Label</Label>
                <Input
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select
                    value={editing.type}
                    onValueChange={(v) => setEditing({ ...editing, type: v as CmsPropType })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Order</Label>
                  <Input
                    type="number"
                    value={editing.display_order}
                    onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.is_active}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <Label>Visible on task pages</Label>
              </div>
              {supportsOptions && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  {editing.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        placeholder="Label"
                        value={o.label}
                        onChange={(e) => {
                          const opts = [...editing.options];
                          opts[i] = { ...opts[i], label: e.target.value, value: opts[i].value || slugify(e.target.value) };
                          setEditing({ ...editing, options: opts });
                        }}
                      />
                      <Button variant="ghost" size="icon" onClick={() => {
                        setEditing({ ...editing, options: editing.options.filter((_, j) => j !== i) });
                      }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => setEditing({
                      ...editing,
                      options: [...editing.options, { value: "", label: "" } as CmsPropOption],
                    })}
                  >
                    <Plus className="w-3 h-3 mr-1" />Add option
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CmsLayout>
  );
}
