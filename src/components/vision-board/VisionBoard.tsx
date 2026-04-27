import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";
import { Plus, Search, Settings2, Calendar, User as UserIcon, AlertCircle, CheckCircle2, Clock, ListTodo, Filter } from "lucide-react";
import { format, isBefore, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useVisionBoard, URGENCY_COLUMNS, STATUS_LABELS, type VisionPlan, type VisionUrgency, type VisionStatus } from "@/hooks/useVisionBoard";
import { VisionPlanDialog } from "./VisionPlanDialog";
import { VisionTagsDialog } from "./VisionTagsDialog";

interface AdminUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

const urgencyStyles: Record<VisionUrgency, { header: string; ring: string }> = {
  critical: { header: "bg-destructive/10 text-destructive border-destructive/30", ring: "ring-destructive/20" },
  high: { header: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30", ring: "ring-orange-500/20" },
  medium: { header: "bg-primary/10 text-primary border-primary/30", ring: "ring-primary/20" },
  low: { header: "bg-muted text-muted-foreground border-border", ring: "ring-border" },
};

const statusBadgeVariant: Record<VisionStatus, "default" | "secondary" | "outline"> = {
  not_started: "outline",
  in_progress: "secondary",
  completed: "default",
};

interface VisionBoardProps {
  compact?: boolean;
}

export function VisionBoard({ compact = false }: VisionBoardProps) {
  const { plans, tags, loading } = useVisionBoard();
  const { toast } = useToast();
  const [planDialog, setPlanDialog] = useState<{ open: boolean; plan?: VisionPlan | null; urgency?: VisionUrgency }>({ open: false });
  const [tagsDialog, setTagsDialog] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | VisionStatus>("all");
  const [filterTag, setFilterTag] = useState("all");
  const [filterDeadline, setFilterDeadline] = useState("all");
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    (async () => {
      // Fetch admins for owner picker
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) return;
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids);
      setAdminUsers(profs ?? []);
    })();
  }, []);

  const ownerNameFor = (p: VisionPlan): string | null => {
    if (p.owner_name) return p.owner_name;
    if (p.owner_user_id) {
      const u = adminUsers.find((a) => a.user_id === p.owner_user_id);
      return u?.full_name || u?.email || "Admin";
    }
    return null;
  };

  const filteredPlans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter((p) => {
      if (q && !p.title.toLowerCase().includes(q) && !p.description?.toLowerCase().includes(q)) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (filterTag !== "all" && !p.tags?.includes(filterTag)) return false;
      if (filterOwner !== "all") {
        if (filterOwner === "unassigned" && (p.owner_user_id || p.owner_name)) return false;
        if (filterOwner !== "unassigned" && p.owner_user_id !== filterOwner) return false;
      }
      if (filterDeadline !== "all" && p.deadline) {
        const today = new Date();
        const d = parseISO(p.deadline);
        if (filterDeadline === "overdue" && !(isBefore(d, today) && p.status !== "completed")) return false;
        if (filterDeadline === "this_month" && (d.getMonth() !== today.getMonth() || d.getFullYear() !== today.getFullYear())) return false;
      } else if (filterDeadline !== "all" && !p.deadline) {
        return false;
      }
      return true;
    });
  }, [plans, search, filterStatus, filterTag, filterOwner, filterDeadline]);

  const grouped = useMemo(() => {
    const g: Record<VisionUrgency, VisionPlan[]> = { critical: [], high: [], medium: [], low: [] };
    filteredPlans.forEach((p) => g[p.urgency].push(p));
    return g;
  }, [filteredPlans]);

  const stats = useMemo(() => {
    const total = plans.length;
    const completed = plans.filter((p) => p.status === "completed").length;
    const inProgress = plans.filter((p) => p.status === "in_progress").length;
    const notStarted = plans.filter((p) => p.status === "not_started").length;
    const byUrgency: Record<VisionUrgency, number> = {
      critical: plans.filter((p) => p.urgency === "critical").length,
      high: plans.filter((p) => p.urgency === "high").length,
      medium: plans.filter((p) => p.urgency === "medium").length,
      low: plans.filter((p) => p.urgency === "low").length,
    };
    return { total, completed, inProgress, notStarted, byUrgency };
  }, [plans]);

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const planId = String(active.id);
    const newUrgency = String(over.id) as VisionUrgency;
    const plan = plans.find((p) => p.id === planId);
    if (!plan || plan.urgency === newUrgency) return;
    const { error } = await supabase.from("vision_board_plans").update({ urgency: newUrgency }).eq("id", planId);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
  };

  const activePlan = activeId ? plans.find((p) => p.id === activeId) : null;
  const tagColorMap = useMemo(() => Object.fromEntries(tags.map((t) => [t.name, t.color])), [tags]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading vision board…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard icon={<ListTodo className="h-4 w-4" />} label="Total Plans" value={stats.total} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} label="Completed" value={stats.completed} />
        <StatCard icon={<Clock className="h-4 w-4 text-blue-600" />} label="In Progress" value={stats.inProgress} />
        <StatCard icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />} label="Not Started" value={stats.notStarted} />
        {URGENCY_COLUMNS.map((c) => (
          <StatCard
            key={c.id}
            icon={<span className={cn("h-2.5 w-2.5 rounded-full inline-block", c.id === "critical" && "bg-destructive", c.id === "high" && "bg-orange-500", c.id === "medium" && "bg-primary", c.id === "low" && "bg-muted-foreground")} />}
            label={c.title}
            value={stats.byUrgency[c.id]}
          />
        ))}
      </div>

      {/* Filters */}
      {!compact && (
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plans…" className="pl-8" />
            </div>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterOwner} onValueChange={setFilterOwner}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {adminUsers.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterTag} onValueChange={setFilterTag}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {tags.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDeadline} onValueChange={setFilterDeadline}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Deadline</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setTagsDialog(true)}>
              <Settings2 className="h-4 w-4 mr-1" /> Tags
            </Button>
            <Button size="sm" onClick={() => setPlanDialog({ open: true })}>
              <Plus className="h-4 w-4 mr-1" /> New Plan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Board */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {URGENCY_COLUMNS.map((col) => (
            <Column
              key={col.id}
              urgency={col.id}
              title={col.title}
              description={col.description}
              count={grouped[col.id].length}
              styleSet={urgencyStyles[col.id]}
              plans={grouped[col.id]}
              onAdd={() => setPlanDialog({ open: true, urgency: col.id })}
              onEdit={(p) => setPlanDialog({ open: true, plan: p })}
              ownerNameFor={ownerNameFor}
              tagColorMap={tagColorMap}
              compact={compact}
            />
          ))}
        </div>
        <DragOverlay>
          {activePlan && <PlanCardView plan={activePlan} ownerName={ownerNameFor(activePlan)} tagColorMap={tagColorMap} dragging />}
        </DragOverlay>
      </DndContext>

      <VisionPlanDialog
        open={planDialog.open}
        onOpenChange={(o) => setPlanDialog((s) => ({ ...s, open: o }))}
        plan={planDialog.plan}
        defaultUrgency={planDialog.urgency}
        tags={tags}
        adminUsers={adminUsers}
      />
      <VisionTagsDialog open={tagsDialog} onOpenChange={setTagsDialog} tags={tags} />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        <div className="text-xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function Column({
  urgency,
  title,
  description,
  count,
  styleSet,
  plans,
  onAdd,
  onEdit,
  ownerNameFor,
  tagColorMap,
  compact,
}: {
  urgency: VisionUrgency;
  title: string;
  description: string;
  count: number;
  styleSet: { header: string; ring: string };
  plans: VisionPlan[];
  onAdd: () => void;
  onEdit: (p: VisionPlan) => void;
  ownerNameFor: (p: VisionPlan) => string | null;
  tagColorMap: Record<string, string>;
  compact?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: urgency });
  return (
    <div ref={setNodeRef} className={cn("rounded-lg border bg-card/50 flex flex-col min-h-[200px]", isOver && "ring-2", isOver && styleSet.ring)}>
      <div className={cn("px-3 py-2.5 border-b rounded-t-lg flex items-center justify-between", styleSet.header)}>
        <div>
          <div className="font-semibold text-sm flex items-center gap-2">
            {title}
            <span className="text-xs font-normal opacity-70">({count})</span>
          </div>
          <p className="text-[10px] opacity-70 leading-tight">{description}</p>
        </div>
        {!compact && (
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="p-2 space-y-2 flex-1">
        {plans.map((p) => (
          <DraggableCard key={p.id} plan={p} onEdit={() => onEdit(p)} ownerName={ownerNameFor(p)} tagColorMap={tagColorMap} />
        ))}
        {plans.length === 0 && (
          <div className="text-center py-6 text-xs text-muted-foreground">No plans</div>
        )}
      </div>
    </div>
  );
}

function DraggableCard({ plan, onEdit, ownerName, tagColorMap }: { plan: VisionPlan; onEdit: () => void; ownerName: string | null; tagColorMap: Record<string, string> }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: plan.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onEdit}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-30")}
    >
      <PlanCardView plan={plan} ownerName={ownerName} tagColorMap={tagColorMap} />
    </div>
  );
}

function PlanCardView({ plan, ownerName, tagColorMap, dragging }: { plan: VisionPlan; ownerName: string | null; tagColorMap: Record<string, string>; dragging?: boolean }) {
  const overdue = plan.deadline && plan.status !== "completed" && isBefore(parseISO(plan.deadline), new Date());
  return (
    <div className={cn(
      "rounded-md border bg-card p-3 shadow-sm hover:shadow-md transition-shadow space-y-2",
      dragging && "shadow-lg ring-2 ring-primary",
      overdue && "border-l-4 border-l-destructive"
    )}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold leading-tight">{plan.title}</h4>
        <Badge variant={statusBadgeVariant[plan.status]} className="text-[10px] shrink-0">
          {STATUS_LABELS[plan.status]}
        </Badge>
      </div>
      {plan.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{plan.description}</p>
      )}
      {plan.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {plan.tags.map((t) => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${tagColorMap[t] || "#888"}20`, color: tagColorMap[t] || "#888" }}>
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
        {ownerName ? (
          <div className="flex items-center gap-1 truncate">
            <UserIcon className="h-3 w-3 shrink-0" />
            <span className="truncate">{ownerName}</span>
          </div>
        ) : <span className="italic opacity-60">Unassigned</span>}
        {plan.deadline && (
          <div className={cn("flex items-center gap-1 shrink-0", overdue && "text-destructive font-medium")}>
            <Calendar className="h-3 w-3" />
            {format(parseISO(plan.deadline), "MMM d")}
          </div>
        )}
      </div>
    </div>
  );
}
