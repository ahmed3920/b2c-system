import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FeatureDoc,
  FeatureDocStatus,
  MODULE_ORDER,
  STATUS_LABEL,
  createFeatureDoc,
  updateFeatureDoc,
} from "@/data/featureDocumentation";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: FeatureDoc | null;
  onSaved: () => void;
}

const ROLES = ["admin", "team_leader", "super_team_leader", "mentor", "community_moderator"];

export function FeatureDocEditDialog({ open, onOpenChange, doc, onSaved }: Props) {
  const [form, setForm] = useState({
    feature_name: "",
    module: "Other",
    description: "",
    purpose: "",
    functionalities: "",
    user_roles: [] as string[],
    status: "needs_review" as FeatureDocStatus,
    how_it_works: "",
    ui_explanation: "",
    notes: "",
    route_path: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (doc) {
      setForm({
        feature_name: doc.feature_name,
        module: doc.module,
        description: doc.description,
        purpose: doc.purpose,
        functionalities: doc.functionalities.join("\n"),
        user_roles: doc.user_roles,
        status: doc.status,
        how_it_works: doc.how_it_works,
        ui_explanation: doc.ui_explanation,
        notes: doc.notes,
        route_path: doc.route_path ?? "",
      });
    } else {
      setForm({
        feature_name: "",
        module: "Other",
        description: "",
        purpose: "",
        functionalities: "",
        user_roles: [],
        status: "needs_review",
        how_it_works: "",
        ui_explanation: "",
        notes: "",
        route_path: "",
      });
    }
  }, [doc, open]);

  const toggleRole = (role: string) => {
    setForm((f) => ({
      ...f,
      user_roles: f.user_roles.includes(role)
        ? f.user_roles.filter((r) => r !== role)
        : [...f.user_roles, role],
    }));
  };

  const handleSave = async () => {
    if (!form.feature_name.trim()) {
      toast.error("Feature name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        feature_name: form.feature_name.trim(),
        module: form.module,
        description: form.description,
        purpose: form.purpose,
        functionalities: form.functionalities
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        user_roles: form.user_roles,
        status: form.status,
        how_it_works: form.how_it_works,
        ui_explanation: form.ui_explanation,
        notes: form.notes,
        route_path: form.route_path.trim() || null,
      };
      if (doc) {
        await updateFeatureDoc(doc.id, payload);
        toast.success("Documentation updated");
      } else {
        await createFeatureDoc(payload);
        toast.success("Documentation created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save documentation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{doc ? "Edit Documentation" : "New Documentation"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Feature Name *</Label>
            <Input
              value={form.feature_name}
              onChange={(e) => setForm({ ...form, feature_name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Module</Label>
              <Select
                value={form.module}
                onValueChange={(v) => setForm({ ...form, module: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULE_ORDER.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v: FeatureDocStatus) => setForm({ ...form, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as FeatureDocStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Route Path</Label>
            <Input
              value={form.route_path}
              onChange={(e) => setForm({ ...form, route_path: e.target.value })}
              placeholder="/dashboard"
            />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Purpose</Label>
            <Textarea
              rows={2}
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Key Functionalities (one per line)</Label>
            <Textarea
              rows={4}
              value={form.functionalities}
              onChange={(e) => setForm({ ...form, functionalities: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>User Roles</Label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => {
                const active = form.user_roles.includes(r);
                return (
                  <button
                    type="button"
                    key={r}
                    onClick={() => toggleRole(r)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>How it works</Label>
            <Textarea
              rows={3}
              value={form.how_it_works}
              onChange={(e) => setForm({ ...form, how_it_works: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>UI explanation</Label>
            <Textarea
              rows={3}
              value={form.ui_explanation}
              onChange={(e) => setForm({ ...form, ui_explanation: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Internal notes</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
