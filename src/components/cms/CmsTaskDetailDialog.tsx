import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays, Flag, CircleDot, MessageSquare,
  Trash2, Send, CheckCircle2, Eye, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  useCmsTaskComments,
  type CmsTaskCommentStatus,
} from "@/hooks/useCmsTaskComments";
import type {
  CmsTask, CmsTaskPriority, CmsTaskStatus,
} from "@/hooks/useCmsTasks";
import { useCmsTaskAssignees } from "@/hooks/useCmsTaskAssignees";
import { useCmsPropertyDefs, useCmsTaskPropertyValues } from "@/hooks/useCmsTaskProperties";
import { MultiAssigneeField } from "./MultiAssigneeField";
import { CmsPropertiesPanel } from "./CmsPropertiesPanel";
import { AttachmentItem, AttachmentPicker } from "./CmsCommentAttachments";
import { useCmsPermissions } from "@/hooks/useCmsPermissions";

const STATUSES: CmsTaskStatus[] = ["todo", "in_progress", "done", "archived"];
const PRIORITIES: CmsTaskPriority[] = ["low", "medium", "high"];
const COMMENT_STATUSES: CmsTaskCommentStatus[] = ["open", "needs_review", "resolved"];

const statusEmoji: Record<CmsTaskStatus, string> = {
  todo: "🟡", in_progress: "🔵", done: "🟢", archived: "⚪",
};

const commentStatusStyles: Record<CmsTaskCommentStatus, string> = {
  open: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400",
  needs_review: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400",
  resolved: "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/10 dark:text-green-400",
};

const commentStatusIcon: Record<CmsTaskCommentStatus, JSX.Element> = {
  open: <CircleDot className="w-3 h-3" />,
  needs_review: <Eye className="w-3 h-3" />,
  resolved: <CheckCircle2 className="w-3 h-3" />,
};

interface Props {
  task: CmsTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: { user_id: string; full_name: string; active_status: boolean }[];
  canManage: boolean;
  onUpdate: (id: string, patch: Partial<CmsTask>) => Promise<{ ok: boolean; error?: string }>;
  onDelete?: (id: string) => Promise<void>;
}

export function CmsTaskDetailDialog({
  task, open, onOpenChange, users, canManage, onUpdate, onDelete,
}: Props) {
  const { toast } = useToast();
  const { comments, add, setStatus: setCommentStatus, remove: removeComment } =
    useCmsTaskComments(task?.id ?? null);
  const { assignees, add: addAssignee, remove: removeAssignee } =
    useCmsTaskAssignees(task?.id ?? null);
  const { defs } = useCmsPropertyDefs();
  const { values, setValue } = useCmsTaskPropertyValues(task?.id ?? null);
  const { can, assignableRoles } = useCmsPermissions();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newComment, setNewComment] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [filter, setFilter] = useState<"all" | CmsTaskCommentStatus>("all");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setPendingFiles([]);
    }
  }, [task]);

  const userMap = useMemo(
    () => new Map(users.map((u) => [u.user_id, u.full_name])),
    [users],
  );

  if (!task) return null;

  const canEditTask = canManage || task.assignee_id === undefined;
  const filteredComments = filter === "all" ? comments : comments.filter((c) => c.status === filter);

  const saveTitle = async () => {
    if (title.trim() && title !== task.title) {
      const res = await onUpdate(task.id, { title: title.trim() });
      if (!res.ok) toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };
  const saveDescription = async () => {
    if (description !== (task.description ?? "")) {
      const res = await onUpdate(task.id, { description: description || null });
      if (!res.ok) toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() && pendingFiles.length === 0) return;
    const res = await add(newComment, pendingFiles);
    if (!res.ok) toast({ title: "Failed", description: res.error, variant: "destructive" });
    else { setNewComment(""); setPendingFiles([]); }
  };

  const counts = {
    open: comments.filter((c) => c.status === "open").length,
    needs_review: comments.filter((c) => c.status === "needs_review").length,
    resolved: comments.filter((c) => c.status === "resolved").length,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Notion-style header */}
        <div className="px-8 pt-8 pb-4 border-b">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            disabled={!canEditTask}
            className="text-3xl font-bold border-0 px-0 h-auto py-1 focus-visible:ring-0 shadow-none bg-transparent"
            placeholder="Untitled"
          />

          {/* Top: Developers + Reviewers + Due */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 mt-4">
            <MultiAssigneeField
              label="Developer"
              role="developer"
              assignees={assignees}
              users={users}
              canEdit={canManage}
              onAdd={(uid, role) => addAssignee(uid, role)}
              onRemove={(id) => removeAssignee(id)}
            />
            <MultiAssigneeField
              label="Senior Developer"
              role="senior_developer"
              assignees={assignees}
              users={users}
              canEdit={canManage}
              onAdd={(uid, role) => addAssignee(uid, role)}
              onRemove={(id) => removeAssignee(id)}
            />
            <MultiAssigneeField
              label="Reviewer"
              role="reviewer"
              assignees={assignees}
              users={users}
              canEdit={canManage}
              onAdd={(uid, role) => addAssignee(uid, role)}
              onRemove={(id) => removeAssignee(id)}
            />
            <MultiAssigneeField
              label="Team Leader"
              role="team_leader"
              assignees={assignees}
              users={users}
              canEdit={canManage}
              onAdd={(uid, role) => addAssignee(uid, role)}
              onRemove={(id) => removeAssignee(id)}
            />

            <PropertyRow icon={<CalendarDays className="w-4 h-4" />} label="Due Date">
              <Input
                type="date"
                value={task.date_to ?? ""}
                onChange={(e) =>
                  onUpdate(task.id, { date_to: e.target.value || null } as Partial<CmsTask>)
                }
                disabled={!canEditTask}
                className="h-7 w-auto border-0 bg-secondary/50 hover:bg-secondary text-sm px-2"
              />
            </PropertyRow>

            <PropertyRow icon={<CircleDot className="w-4 h-4" />} label="Status">
              <Select
                value={task.status}
                onValueChange={(v) => onUpdate(task.id, { status: v as CmsTaskStatus })}
                disabled={!canEditTask}
              >
                <SelectTrigger className="h-7 w-auto border-0 bg-secondary/50 hover:bg-secondary text-sm px-2 gap-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="mr-2">{statusEmoji[s]}</span>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>

            <PropertyRow icon={<Flag className="w-4 h-4" />} label="Priority">
              <Select
                value={task.priority}
                onValueChange={(v) => onUpdate(task.id, { priority: v as CmsTaskPriority })}
                disabled={!canEditTask}
              >
                <SelectTrigger className="h-7 w-auto border-0 bg-secondary/50 hover:bg-secondary text-sm px-2 gap-1 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>
          </div>
        </div>

        {/* Body — properties, description, comments */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
          {/* Custom Properties */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Properties</h3>
            <CmsPropertiesPanel
              defs={defs}
              values={values}
              users={users}
              canEdit={canEditTask}
              onSetValue={(propId, v) => setValue(propId, v)}
            />
          </section>

          {/* Description */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Description</h3>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              disabled={!canEditTask}
              placeholder="Add a description..."
              className="min-h-[100px] border border-dashed resize-none focus-visible:border-solid"
            />
          </section>

          {/* Comments thread */}
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comments
                <Badge variant="secondary" className="ml-1">{comments.length}</Badge>
              </h3>
              <div className="flex items-center gap-1 flex-wrap">
                <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All</FilterChip>
                <FilterChip
                  active={filter === "open"}
                  onClick={() => setFilter("open")}
                  className={commentStatusStyles.open}
                >
                  <CircleDot className="w-3 h-3 mr-1" />Open <span className="ml-1 opacity-70">{counts.open}</span>
                </FilterChip>
                <FilterChip
                  active={filter === "needs_review"}
                  onClick={() => setFilter("needs_review")}
                  className={commentStatusStyles.needs_review}
                >
                  <Eye className="w-3 h-3 mr-1" />Needs Review <span className="ml-1 opacity-70">{counts.needs_review}</span>
                </FilterChip>
                <FilterChip
                  active={filter === "resolved"}
                  onClick={() => setFilter("resolved")}
                  className={commentStatusStyles.resolved}
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />Resolved <span className="ml-1 opacity-70">{counts.resolved}</span>
                </FilterChip>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              {filteredComments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
                  No comments yet. Add the first one below.
                </p>
              ) : (
                filteredComments.map((c) => (
                  <div key={c.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          {(c.created_by_name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{c.created_by_name ?? "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Select
                          value={c.status}
                          onValueChange={(v) => setCommentStatus(c.id, v as CmsTaskCommentStatus)}
                        >
                          <SelectTrigger
                            className={cn("h-7 px-2 text-xs gap-1 border", commentStatusStyles[c.status])}
                          >
                            <span className="flex items-center gap-1">
                              {commentStatusIcon[c.status]}
                              <SelectValue />
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {COMMENT_STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">
                                {s.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeComment(c.id)}
                          title="Delete comment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {c.body && <p className="text-sm whitespace-pre-wrap pl-9">{c.body}</p>}
                    {c.attachments && c.attachments.length > 0 && (
                      <div className="pl-9 mt-2 flex flex-wrap gap-2">
                        {c.attachments.map((a, i) => (
                          <AttachmentItem key={i} att={a} />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* New comment composer */}
            <div className="space-y-2 border rounded-lg p-3 bg-card">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment or feedback…"
                className="min-h-[60px] resize-none border-0 px-0 focus-visible:ring-0 shadow-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <AttachmentPicker files={pendingFiles} onChange={setPendingFiles} />
                <Button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() && pendingFiles.length === 0}
                  size="sm"
                >
                  <Send className="w-4 h-4 mr-1" />Post
                </Button>
              </div>
            </div>
          </section>
        </div>

        {canManage && onDelete && (
          <div className="border-t px-8 py-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={async () => {
                await onDelete(task.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" />Delete task
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PropertyRow({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 min-h-[32px]">
      <div className="flex items-center gap-2 text-muted-foreground text-sm min-w-[110px]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function FilterChip({
  active, onClick, children, className,
}: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-xs px-2.5 py-1 rounded-full border flex items-center transition-colors",
        active
          ? cn("border-foreground/40 font-medium", className)
          : "border-transparent bg-secondary/50 text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}
