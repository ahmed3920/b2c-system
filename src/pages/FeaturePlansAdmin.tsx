import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Rocket, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import {
  FeaturePlan,
  FEATURE_MODULES,
  getFeaturePlans,
  removeFeaturePlan,
  subscribeFeaturePlans,
  visibilityLabel,
} from "@/data/mockFeaturePlans";
import { FeatureStatusBadge } from "@/components/feature-plans/FeatureStatusBadge";
import { FeatureFormDialog } from "@/components/feature-plans/FeatureFormDialog";
import { FeatureDetailsDialog } from "@/components/feature-plans/FeatureDetailsDialog";
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
import { useToast } from "@/hooks/use-toast";

export default function FeaturePlansAdmin() {
  const { toast } = useToast();
  const [items, setItems] = useState<FeaturePlan[]>(getFeaturePlans());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FeaturePlan | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewing, setViewing] = useState<FeaturePlan | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");

  useEffect(() => {
    const unsub = subscribeFeaturePlans(() => setItems(getFeaturePlans()));
    return () => {
      unsub();
    };
  }, []);

  const filtered = useMemo(() => {
    return items.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (moduleFilter !== "all" && f.module !== moduleFilter) return false;
      if (visibilityFilter !== "all" && f.visibility !== visibilityFilter) return false;
      return true;
    });
  }, [items, statusFilter, moduleFilter, visibilityFilter]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (f: FeaturePlan) => {
    setEditing(f);
    setFormOpen(true);
  };

  const openDetails = (f: FeaturePlan) => {
    setViewing(f);
    setDetailsOpen(true);
  };

  const handleDelete = () => {
    if (deletingId) {
      removeFeaturePlan(deletingId);
      toast({ title: "Feature deleted" });
      setDeletingId(null);
    }
  };

  return (
    <AppLayout title="Feature Plans Management" allowedRoles={["admin"]}>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Rocket className="h-6 w-6 text-primary" />
              Feature Plans
            </h1>
            <p className="text-sm text-muted-foreground">
              Plan, track, and roll out new product features.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Create Feature
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px] space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[160px] space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Module</label>
              <Select value={moduleFilter} onValueChange={setModuleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {FEATURE_MODULES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[160px] space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Visibility</label>
              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="team_leaders">Team Leaders</SelectItem>
                  <SelectItem value="mentors">Mentors</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="hidden">Hidden</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(statusFilter !== "all" || moduleFilter !== "all" || visibilityFilter !== "all") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setStatusFilter("all");
                  setModuleFilter("all");
                  setVisibilityFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px]">Progress</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Target Release</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      No feature plans match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((f) => (
                    <TableRow
                      key={f.id}
                      className="cursor-pointer"
                      onClick={() => openDetails(f)}
                    >
                      <TableCell className="font-medium max-w-[260px] truncate">
                        {f.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{f.module}</Badge>
                      </TableCell>
                      <TableCell>
                        <FeatureStatusBadge status={f.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={f.progress} className="h-1.5 w-24" />
                          <span className="text-xs font-medium tabular-nums w-9">
                            {f.progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{f.assignedTo}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(f.targetRelease), "PP")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.visibility === "hidden" ? "secondary" : "outline"} className="gap-1">
                          {f.visibility === "hidden" ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                          {visibilityLabel(f.visibility)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(f)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeletingId(f.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <FeatureFormDialog open={formOpen} onOpenChange={setFormOpen} feature={editing} />
      <FeatureDetailsDialog feature={viewing} open={detailsOpen} onOpenChange={setDetailsOpen} />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this feature plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the feature. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
