import { useEffect, useMemo, useState } from "react";
import { CmsLayout } from "@/components/cms/CmsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, AlertTriangle } from "lucide-react";
import { useCmsTasks, type CmsTaskStatus, type CmsTaskPriority } from "@/hooks/useCmsTasks";
import { supabase } from "@/integrations/supabase/client";
import { useCmsRole } from "@/hooks/useCmsRole";
import { useCmsUsers } from "@/hooks/useCmsUsers";
import { useCmsPermissions } from "@/hooks/useCmsPermissions";
import { useToast } from "@/hooks/use-toast";
import { TaskDueDateBadge, getTaskDueStatus } from "@/components/task/TaskDueDateBadge";
import { cn } from "@/lib/utils";
import { CmsTaskDetailDialog } from "@/components/cms/CmsTaskDetailDialog";
import type { CmsTask } from "@/hooks/useCmsTasks";
import { useCmsPropertyDefs } from "@/hooks/useCmsTaskProperties";
import {
  CmsTaskFilters, applyTaskFilters, useCmsTaskFilterIndex, emptyFilters,
  type TaskFilterState,
} from "@/components/cms/CmsTaskFilters";
import { useCmsTaskCategories } from "@/hooks/useCmsTaskCategories";
import { MultiAssigneeField } from "@/components/cms/MultiAssigneeField";
import type { CmsAssigneeRole } from "@/hooks/useCmsTaskAssignees";

const STATUSES: CmsTaskStatus[] = ["todo", "in_progress", "done", "archived"];
const PRIORITIES: CmsTaskPriority[] = ["low", "medium", "high"];

const statusClasses: Record<CmsTaskStatus, string> = {
  todo: "bg-yellow-100 text-yellow-700 border-yellow-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  done: "bg-green-100 text-green-700 border-green-200",
  archived: "bg-gray-100 text-gray-700 border-gray-200",
};

const priorityClasses: Record<CmsTaskPriority, string> = {
  low: "bg-gray-100 text-gray-700 border-gray-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
};

const ROLE_LABELS: Record<CmsAssigneeRole, string> = {
  developer: "Developer",
  senior_developer: "Senior Developer",
  reviewer: "Reviewer",
  team_leader: "Team Leader",
};

interface PendingAssignee { user_id: string; role: CmsAssigneeRole; tmp_id: string }

export default function CmsTasks() {
  const { tasks, loading, create, update, remove } = useCmsTasks();
  const { isCmsAdmin, isCmsSupervisor } = useCmsRole();
  const { can } = useCmsPermissions();
  const canCreate = can("create_task");
  const canDelete = can("delete_task");
  const canManage = isCmsAdmin || isCmsSupervisor || can("edit_any_task");
  const { users } = useCmsUsers();
  const { categories } = useCmsTaskCategories();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<CmsTaskPriority>("medium");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [dateTo, setDateTo] = useState("");
  const [pendingAssignees, setPendingAssignees] = useState<PendingAssignee[]>([]);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openTask, setOpenTask] = useState<CmsTask | null>(null);

  const userMap = useMemo(() => new Map(users.map((u) => [u.user_id, u.full_name])), [users]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const [filters, setFilters] = useState<TaskFilterState>(emptyFilters);
  const { defs } = useCmsPropertyDefs();
  const filterIndex = useCmsTaskFilterIndex();

  const filtered = useMemo(() => {
    const byStatus = tasks.filter((t) => statusFilter === "all" || t.status === statusFilter);
    return applyTaskFilters(byStatus, filters, filterIndex);
  }, [tasks, statusFilter, filters, filterIndex]);

  const reset = () => {
    setTitle(""); setDescription(""); setPriority("medium");
    setCategoryId("none"); setDateTo(""); setPendingAssignees([]);
  };

  const handleCreate = async () => {
    if (!title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    const res = await create({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status: "todo",
      assignee_id: pendingAssignees[0]?.user_id ?? null,
      category_id: categoryId === "none" ? null : categoryId,
      date_to: dateTo || null,
    });
    if (!res.ok) { toast({ title: "Failed", description: res.error, variant: "destructive" }); return; }
    if (res.task && pendingAssignees.length > 0) {
      const rows = pendingAssignees.map((p) => ({
        task_id: res.task.id, user_id: p.user_id, role: p.role,
      }));
      const { error } = await supabase.from("cms_task_assignees").insert(rows);
      if (error) toast({ title: "Assignees failed", description: error.message, variant: "destructive" });
    }
    toast({ title: "Task created" }); reset(); setOpen(false);
  };

  const usersByTitle = (t: CmsAssigneeRole) => users.filter((u) => (u.title ?? null) === t && u.active_status);

  const addPending = (user_id: string, role: CmsAssigneeRole) =>
    setPendingAssignees((p) => [...p, { user_id, role, tmp_id: crypto.randomUUID() }]);
  const removePending = (tmp_id: string) =>
    setPendingAssignees((p) => p.filter((x) => x.tmp_id !== tmp_id));

  // Adapter so MultiAssigneeField works with pending list
  const pendingAsAssignees = pendingAssignees.map((p) => ({
    id: p.tmp_id, task_id: "tmp", user_id: p.user_id, role: p.role, created_at: "",
  }));


  const overdueCount = filtered.filter((t) => getTaskDueStatus(t.date_to, t.status) === "overdue").length;
  const dueSoonCount = filtered.filter((t) => getTaskDueStatus(t.date_to, t.status) === "due-soon").length;

  return (
    <CmsLayout title="Tasks">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap items-center gap-2">
            {overdueCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-destructive/10 text-destructive text-sm rounded-full font-medium">
                <AlertTriangle className="w-3 h-3" />
                {overdueCount} Overdue
              </span>
            )}
            {dueSoonCount > 0 && (
              <span className="px-2 py-1 bg-orange-100 text-orange-700 text-sm rounded-full font-medium">
                {dueSoonCount} Due Soon
              </span>
            )}
            {canCreate && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-1" />New task</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Create task</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                    <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Priority</Label>
                        <Select value={priority} onValueChange={(v) => setPriority(v as CmsTaskPriority)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>Due date</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select value={categoryId} onValueChange={setCategoryId}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No category</SelectItem>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="inline-flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                                {c.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 pt-2 border-t">
                      <Label>Assignees</Label>
                      {(["developer", "senior_developer", "reviewer", "team_leader"] as CmsAssigneeRole[]).map((role) => (
                        <MultiAssigneeField
                          key={role}
                          label={ROLE_LABELS[role]}
                          role={role}
                          assignees={pendingAsAssignees}
                          users={usersByTitle(role)}
                          canEdit
                          onAdd={(uid, r) => addPending(uid, r)}
                          onRemove={(id) => removePending(id)}
                        />
                      ))}
                    </div>
                  </div>
                  <DialogFooter><Button onClick={handleCreate}>Create</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <CmsTaskFilters users={users} defs={defs} filters={filters} onChange={setFilters} />

        <Card>
          <CardHeader><CardTitle>Tasks ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due</TableHead>
                  {canDelete && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No tasks</TableCell></TableRow>
                ) : filtered.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setOpenTask(t)}
                  >
                    <TableCell>
                      <div className="font-medium">{t.title}</div>
                      {t.description && <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={t.status}
                        onValueChange={(v) => update(t.id, { status: v as CmsTaskStatus })}
                      >
                        <SelectTrigger className={cn("w-[140px] h-8 border", statusClasses[t.status])}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("capitalize", priorityClasses[t.priority])}>
                        {t.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{t.assignee_id ? userMap.get(t.assignee_id) ?? "—" : <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{t.date_to ?? "—"}</span>
                        <TaskDueDateBadge dateTo={t.date_to} status={t.status} size="sm" showLabel={false} />
                      </div>
                    </TableCell>
                    {canDelete && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => remove(t.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <CmsTaskDetailDialog
        task={openTask}
        open={!!openTask}
        onOpenChange={(o) => !o && setOpenTask(null)}
        users={users}
        canManage={canManage}
        onUpdate={async (id, patch) => {
          const res = await update(id, patch as never);
          // refresh local openTask snapshot
          if (res.ok && openTask?.id === id) {
            setOpenTask({ ...openTask, ...patch } as CmsTask);
          }
          return res;
        }}
        onDelete={async (id) => { await remove(id); }}
      />
    </CmsLayout>
  );
}
