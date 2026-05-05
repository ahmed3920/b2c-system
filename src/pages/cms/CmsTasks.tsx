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
import { useCmsRole } from "@/hooks/useCmsRole";
import { useCmsUsers } from "@/hooks/useCmsUsers";
import { useToast } from "@/hooks/use-toast";
import { TaskDueDateBadge, getTaskDueStatus } from "@/components/task/TaskDueDateBadge";
import { cn } from "@/lib/utils";
import { CmsTaskDetailDialog } from "@/components/cms/CmsTaskDetailDialog";
import type { CmsTask } from "@/hooks/useCmsTasks";

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

export default function CmsTasks() {
  const { tasks, loading, create, update, remove } = useCmsTasks();
  const { isCmsAdmin, isCmsSupervisor, role } = useCmsRole();
  const canManage = isCmsAdmin || isCmsSupervisor;
  const { users } = useCmsUsers();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<CmsTaskPriority>("medium");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dateTo, setDateTo] = useState("");

  const [statusFilter, setStatusFilter] = useState<string>("all");

  const userMap = useMemo(() => new Map(users.map((u) => [u.user_id, u.full_name])), [users]);

  const filtered = tasks.filter((t) => statusFilter === "all" || t.status === statusFilter);

  const reset = () => {
    setTitle(""); setDescription(""); setPriority("medium"); setAssigneeId(""); setDateTo("");
  };

  const handleCreate = async () => {
    if (!title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    const res = await create({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status: "todo",
      assignee_id: assigneeId || null,
      date_to: dateTo || null,
    });
    if (!res.ok) toast({ title: "Failed", description: res.error, variant: "destructive" });
    else { toast({ title: "Task created" }); reset(); setOpen(false); }
  };

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
            {canManage && (
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
                      <Label>Assignee</Label>
                      <Select value={assigneeId || "unassigned"} onValueChange={(v) => setAssigneeId(v === "unassigned" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.filter((u) => u.active_status).map((u) => (
                            <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter><Button onClick={handleCreate}>Create</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Tasks ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Due</TableHead>
                  {canManage && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No tasks</TableCell></TableRow>
                ) : filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.title}</div>
                      {t.description && <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>}
                    </TableCell>
                    <TableCell>
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
                    {canManage && (
                      <TableCell>
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
    </CmsLayout>
  );
}
