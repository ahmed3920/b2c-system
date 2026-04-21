import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useDeleteStudyModule,
  useStudyModules,
  useUpsertStudyModule,
  type StudyModule,
} from "@/hooks/useStudyModulesAdmin";
import { Alert, AlertDescription } from "@/components/ui/alert";

const empty: Partial<StudyModule> = {
  grade_band: "",
  module_code: "",
  hours_required: 1,
  display_order: 0,
  is_active: true,
};

export function CourseManagementCard() {
  const { data: modules = [], isLoading } = useStudyModules();
  const upsert = useUpsertStudyModule();
  const del = useDeleteStudyModule();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<StudyModule>>(empty);

  const openNew = () => {
    setDraft(empty);
    setOpen(true);
  };
  const openEdit = (m: StudyModule) => {
    setDraft(m);
    setOpen(true);
  };

  const save = async () => {
    if (!draft.grade_band || !draft.module_code || !draft.hours_required) {
      toast.error("Grade band, module code and hours are required");
      return;
    }
    try {
      await upsert.mutateAsync(draft);
      toast.success(draft.id ? "Module updated" : "Module added");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save module");
    }
  };

  const remove = async (m: StudyModule) => {
    if (!confirm(`Delete ${m.grade_band} · ${m.module_code}?`)) return;
    try {
      await del.mutateAsync(m.id);
      toast.success("Module deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete module");
    }
  };

  // group by grade
  const grouped = modules.reduce<Record<string, StudyModule[]>>((acc, m) => {
    (acc[m.grade_band] ??= []).push(m);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Course management</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Manage grade bands, modules and required hours.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" />
          Add module
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Changes here take effect on the <b>next plan generation</b>. Existing
            saved weekly plans are not modified — re-run <b>Generate Plan</b> to
            apply new hours.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : modules.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            No modules defined yet. Click <b>Add module</b> to start.
          </div>
        ) : (
          Object.entries(grouped).map(([grade, items]) => (
            <div key={grade} className="space-y-2">
              <div className="text-sm font-semibold">{grade}</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Module code</TableHead>
                    <TableHead className="w-28 text-center">Hours</TableHead>
                    <TableHead className="w-28 text-center">Order</TableHead>
                    <TableHead className="w-28 text-center">Active</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.module_code}</TableCell>
                      <TableCell className="text-center">{m.hours_required}</TableCell>
                      <TableCell className="text-center">{m.display_order}</TableCell>
                      <TableCell className="text-center">
                        {m.is_active ? "Yes" : "No"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(m)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit module" : "Add module"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Grade band</Label>
              <Input
                placeholder="e.g. KG, G1-G3, G4-G6"
                value={draft.grade_band ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, grade_band: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Module code</Label>
              <Input
                placeholder="e.g. M01"
                value={draft.module_code ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, module_code: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Hours required</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={draft.hours_required ?? 0}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      hours_required: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label>Display order</Label>
                <Input
                  type="number"
                  value={draft.display_order ?? 0}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      display_order: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="active"
                checked={draft.is_active ?? true}
                onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
              />
              <Label htmlFor="active" className="cursor-pointer">
                Active (included in plan generation)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
