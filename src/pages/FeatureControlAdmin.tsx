import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToggleLeft, Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  useFeatureControls,
  type FeatureControl,
  ROLE_FIELD,
} from "@/hooks/useFeatureControls";
import type { AppRole } from "@/hooks/useUserRole";

const ROLE_TABS: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "super_team_leader", label: "Super Team Leader" },
  { value: "team_leader", label: "Team Leader" },
  { value: "mentor", label: "Mentor" },
  { value: "community_moderator", label: "Community Moderator" },
];

interface FormState {
  feature_key: string;
  name: string;
  description: string;
  route_path: string;
  display_order: number;
  enabled_admin: boolean;
  enabled_super_team_leader: boolean;
  enabled_team_leader: boolean;
  enabled_mentor: boolean;
  enabled_community_moderator: boolean;
}

const emptyForm = (): FormState => ({
  feature_key: "",
  name: "",
  description: "",
  route_path: "",
  display_order: 0,
  enabled_admin: true,
  enabled_super_team_leader: true,
  enabled_team_leader: true,
  enabled_mentor: true,
  enabled_community_moderator: true,
});

export default function FeatureControlAdmin() {
  const { features, loading, refresh } = useFeatureControls();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<AppRole | "all">("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FeatureControl | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return features.filter(
      (f) =>
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.feature_key.toLowerCase().includes(q) ||
        (f.route_path ?? "").toLowerCase().includes(q),
    );
  }, [features, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (f: FeatureControl) => {
    setEditing(f);
    setForm({
      feature_key: f.feature_key,
      name: f.name,
      description: f.description ?? "",
      route_path: f.route_path ?? "",
      display_order: f.display_order,
      enabled_admin: f.enabled_admin,
      enabled_super_team_leader: f.enabled_super_team_leader,
      enabled_team_leader: f.enabled_team_leader,
      enabled_mentor: f.enabled_mentor,
      enabled_community_moderator: f.enabled_community_moderator,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.feature_key.trim() || !form.name.trim()) {
      toast({ title: "Feature key and name are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        feature_key: form.feature_key.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        route_path: form.route_path.trim() || null,
        display_order: form.display_order || 0,
        enabled_admin: form.enabled_admin,
        enabled_super_team_leader: form.enabled_super_team_leader,
        enabled_team_leader: form.enabled_team_leader,
        enabled_mentor: form.enabled_mentor,
        enabled_community_moderator: form.enabled_community_moderator,
      };
      const { error } = editing
        ? await supabase.from("feature_controls").update(payload).eq("id", editing.id)
        : await supabase.from("feature_controls").insert(payload);
      if (error) {
        if ((error as any).code === "23505") {
          throw new Error(`Feature key "${payload.feature_key}" already exists.`);
        }
        throw error;
      }
      toast({ title: editing ? "Feature updated" : "Feature added" });
      setFormOpen(false);
      refresh();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("feature_controls").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Feature removed" });
      setDeleteId(null);
      refresh();
    }
  };

  const toggleQuick = async (f: FeatureControl, role: AppRole) => {
    const field = ROLE_FIELD[role] as keyof FeatureControl;
    const next = !f[field];
    const { error } = await supabase
      .from("feature_controls")
      .update({ [field]: next })
      .eq("id", f.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      refresh();
    }
  };

  return (
    <AppLayout title="Feature Control" allowedRoles={["admin"]}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ToggleLeft className="h-6 w-6 text-primary" />
              Feature Control
            </h1>
            <p className="text-sm text-muted-foreground">
              Enable or disable each app section per role. Disabled features are hidden from the
              sidebar and the routes are blocked.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Add Feature
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search features by name, key, or route..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="all">All Roles</TabsTrigger>
                {ROLE_TABS.map((r) => (
                  <TabsTrigger key={r.value} value={r.value}>
                    {r.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <FeatureTable
                  features={filtered}
                  loading={loading}
                  onEdit={openEdit}
                  onDelete={(id) => setDeleteId(id)}
                  onToggle={toggleQuick}
                />
              </TabsContent>

              {ROLE_TABS.map((r) => (
                <TabsContent key={r.value} value={r.value} className="mt-4">
                  <RoleFeatureTable
                    role={r.value}
                    roleLabel={r.label}
                    features={filtered}
                    loading={loading}
                    onToggle={toggleQuick}
                    onEdit={openEdit}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit feature" : "Add feature"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Feature Key *</Label>
                <Input
                  value={form.feature_key}
                  onChange={(e) => setForm({ ...form, feature_key: e.target.value })}
                  placeholder="e.g. analytics"
                  disabled={!!editing}
                />
              </div>
              <div className="space-y-2">
                <Label>Display Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Analytics"
                />
              </div>
              <div className="space-y-2">
                <Label>Route Path</Label>
                <Input
                  value={form.route_path}
                  onChange={(e) => setForm({ ...form, route_path: e.target.value })}
                  placeholder="e.g. /analytics"
                />
              </div>
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={form.display_order}
                  onChange={(e) =>
                    setForm({ ...form, display_order: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Enabled for roles</p>
              {ROLE_TABS.map((r) => {
                const field = ROLE_FIELD[r.value] as keyof FormState;
                return (
                  <div key={r.value} className="flex items-center justify-between">
                    <Label className="font-normal">{r.label}</Label>
                    <Switch
                      checked={Boolean(form[field])}
                      onCheckedChange={(v) => setForm({ ...form, [field]: v })}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add feature"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this feature?</AlertDialogTitle>
            <AlertDialogDescription>
              The feature will no longer appear in the control list. Existing nav items for it
              will become visible again to all roles. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function FeatureTable({
  features,
  loading,
  onEdit,
  onDelete,
  onToggle,
}: {
  features: FeatureControl[];
  loading: boolean;
  onEdit: (f: FeatureControl) => void;
  onDelete: (id: string) => void;
  onToggle: (f: FeatureControl, role: AppRole) => void;
}) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Feature</TableHead>
            <TableHead>Route</TableHead>
            {ROLE_TABS.map((r) => (
              <TableHead key={r.value} className="text-center whitespace-nowrap">
                {r.label}
              </TableHead>
            ))}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
          ) : features.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No features found.
              </TableCell>
            </TableRow>
          ) : (
            features.map((f) => (
              <TableRow key={f.id}>
                <TableCell>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{f.feature_key}</div>
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {f.route_path || "—"}
                </TableCell>
                {ROLE_TABS.map((r) => {
                  const field = ROLE_FIELD[r.value] as keyof FeatureControl;
                  return (
                    <TableCell key={r.value} className="text-center">
                      <Switch
                        checked={Boolean(f[field])}
                        onCheckedChange={() => onToggle(f, r.value)}
                      />
                    </TableCell>
                  );
                })}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => onEdit(f)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(f.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function RoleFeatureTable({
  role,
  roleLabel,
  features,
  loading,
  onToggle,
  onEdit,
}: {
  role: AppRole;
  roleLabel: string;
  features: FeatureControl[];
  loading: boolean;
  onToggle: (f: FeatureControl, role: AppRole) => void;
  onEdit: (f: FeatureControl) => void;
}) {
  const field = ROLE_FIELD[role] as keyof FeatureControl;
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Feature</TableHead>
            <TableHead>Route</TableHead>
            <TableHead className="text-center w-[160px]">Enabled for {roleLabel}</TableHead>
            <TableHead className="text-right">Edit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
          ) : features.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                No features found.
              </TableCell>
            </TableRow>
          ) : (
            features.map((f) => (
              <TableRow key={f.id}>
                <TableCell>
                  <div className="font-medium">{f.name}</div>
                  {f.description && (
                    <div className="text-xs text-muted-foreground">{f.description}</div>
                  )}
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {f.route_path || "—"}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={Boolean(f[field])}
                    onCheckedChange={() => onToggle(f, role)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => onEdit(f)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
