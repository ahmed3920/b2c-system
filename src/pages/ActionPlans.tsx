import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "@/components/Logo";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Plus, Search, ClipboardList, AlertTriangle, CheckCircle2, Clock, PauseCircle, Flame, TrendingUp, ThumbsUp, ThumbsDown, Users, ChevronRight, Trash2,
} from "lucide-react";
import { format, isAfter } from "date-fns";
import { motion } from "framer-motion";
import {
  CATEGORY_LABELS, STATUS_LABELS, useActionPlans,
  type ActionPlan, type ActionPlanCategory, type ActionPlanStatus,
} from "@/hooks/useActionPlans";
import { CategoryBadge, StatusBadge } from "@/components/action-plans/ActionPlanBadges";
import { CreateActionPlanDialog } from "@/components/action-plans/CreateActionPlanDialog";
import { ActionPlanDetailDialog } from "@/components/action-plans/ActionPlanDetailDialog";
import { FirstStepBadge } from "@/components/action-plans/FirstStepBadge";
import { isFirstStepDone } from "@/components/action-plans/categoryFirstStep";
import { usePlanStepSummaries, type PlanStepSummary } from "@/hooks/usePlanStepSummaries";
import { CATEGORY_COLUMNS, MilestoneCell, EvaluationCell } from "@/components/action-plans/categoryColumns";

const ActionPlans = () => {
  const navigate = useNavigate();
  const { isAdmin, isTeamLeader, isLoading: roleLoading } = useUserRole();
  const { plans, isLoading, refetch } = useActionPlans();
  const planIds = useMemo(() => plans.map((p) => p.id), [plans]);
  const { summaries: stepSummaries, refetch: refetchSummaries } = usePlanStepSummaries(planIds);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ActionPlan | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tlFilter, setTlFilter] = useState<string>("all");
  const [stepFilter, setStepFilter] = useState<string>("all"); // all | pending | in_progress | done
  const [currentTL, setCurrentTL] = useState<string | null>(null);
  const [planToDelete, setPlanToDelete] = useState<ActionPlan | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!planToDelete) return;
    setDeleting(true);
    await supabase.from("action_plan_steps").delete().eq("plan_id", planToDelete.id);
    const { error } = await supabase.from("action_plans").delete().eq("id", planToDelete.id);
    setDeleting(false);
    if (error) {
      toast.error("Failed to delete action plan", { description: error.message });
      return;
    }
    toast.success("Action plan deleted");
    if (selected?.id === planToDelete.id) setSelected(null);
    setPlanToDelete(null);
    refetch();
  };

  useEffect(() => {
    if (roleLoading) return;
    if (!isAdmin && !isTeamLeader) {
      navigate("/home");
      return;
    }
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data } = await supabase.from("profiles").select("mentor_name").eq("user_id", session.user.id).single();
      setCurrentTL(data?.mentor_name ?? null);
    })();
  }, [roleLoading, isAdmin, isTeamLeader, navigate]);

  const teamLeaders = useMemo(() => {
    return Array.from(new Set(plans.map((p) => p.team_leader))).sort();
  }, [plans]);

  const filtered = useMemo(() => {
    return plans.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (tlFilter !== "all" && p.team_leader !== tlFilter) return false;
      if (stepFilter !== "all") {
        const summary = stepSummaries[p.id];
        const notes = summary?.notes ?? [];
        const total = summary?.count ?? 0;
        const done = isFirstStepDone(p.category, notes);
        const variant: "pending" | "in_progress" | "done" =
          done ? "done" : total > 0 ? "in_progress" : "pending";
        if (variant !== stepFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!p.tutor_name.toLowerCase().includes(q) && !(p.tutor_external_id ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [plans, statusFilter, categoryFilter, tlFilter, stepFilter, stepSummaries, search]);

  // Counts per first-step state, respecting all OTHER active filters (status/category/TL/search)
  const stepCounts = useMemo(() => {
    const counts = { all: 0, pending: 0, in_progress: 0, done: 0 };
    for (const p of plans) {
      if (statusFilter !== "all" && p.status !== statusFilter) continue;
      if (categoryFilter !== "all" && p.category !== categoryFilter) continue;
      if (tlFilter !== "all" && p.team_leader !== tlFilter) continue;
      if (search) {
        const q = search.toLowerCase();
        if (!p.tutor_name.toLowerCase().includes(q) && !(p.tutor_external_id ?? "").toLowerCase().includes(q)) continue;
      }
      const summary = stepSummaries[p.id];
      const notes = summary?.notes ?? [];
      const total = summary?.count ?? 0;
      const done = isFirstStepDone(p.category, notes);
      const variant: "pending" | "in_progress" | "done" = done ? "done" : total > 0 ? "in_progress" : "pending";
      counts.all += 1;
      counts[variant] += 1;
    }
    return counts;
  }, [plans, statusFilter, categoryFilter, tlFilter, search, stepSummaries]);

  const today = new Date();
  const kpis = useMemo(() => {
    const active = plans.filter((p) => p.status === "active").length;
    const onHold = plans.filter((p) => p.status === "on_hold").length;
    const resolved = plans.filter((p) => p.status === "resolved").length;
    const escalated = plans.filter((p) => p.status === "escalated").length;
    // Total historical escalation events (a plan re-escalated counts twice).
    const escalationEvents = plans.reduce(
      (acc, p) => acc + (stepSummaries[p.id]?.escalationCount ?? 0),
      0,
    );
    const overdue = plans.filter((p) => p.status !== "resolved" && isAfter(today, new Date(p.due_date))).length;
    const improved = plans.filter((p) => p.evaluation === "improved").length;
    const notImproved = plans.filter((p) => p.evaluation === "not_improved").length;
    const evaluated = improved + notImproved;
    const improvementRate = evaluated > 0 ? Math.round((improved / evaluated) * 100) : 0;
    return { active, onHold, resolved, escalated, escalationEvents, overdue, improved, notImproved, improvementRate, total: plans.length };
  }, [plans, stepSummaries]);

  // Category counts (across all plans, ignoring current category filter)
  // Includes a per-status breakdown so cards can show severity at a glance.
  type CatBreakdown = { total: number; active: number; on_hold: number; resolved: number; escalated: number };
  const categoryCounts = useMemo(() => {
    const empty = (): CatBreakdown => ({ total: 0, active: 0, on_hold: 0, resolved: 0, escalated: 0 });
    const counts: Record<string, CatBreakdown> = { all: empty() };
    for (const c of Object.keys(CATEGORY_LABELS)) counts[c] = empty();
    for (const p of plans) {
      counts.all.total += 1;
      counts.all[p.status] += 1;
      const c = counts[p.category];
      if (c) {
        c.total += 1;
        c[p.status] += 1;
      }
    }
    return counts;
  }, [plans]);

  if (roleLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Logo variant="blue" className="h-8" />
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">Action Plans</span>
              </div>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Plan
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* KPIs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
        >
          <KpiCard label="Active" value={kpis.active} icon={<Clock className="w-5 h-5 text-blue-500" />} />
          <KpiCard label="On Hold" value={kpis.onHold} icon={<PauseCircle className="w-5 h-5 text-yellow-500" />} />
          <KpiCard label="Resolved" value={kpis.resolved} icon={<CheckCircle2 className="w-5 h-5 text-green-500" />} />
          <KpiCard
            label="Escalated"
            value={Math.max(kpis.escalationEvents, kpis.escalated)}
            icon={<Flame className="w-5 h-5 text-destructive" />}
            sub={
              kpis.escalationEvents > kpis.escalated
                ? `${kpis.escalated} now · ${kpis.escalationEvents} total`
                : kpis.escalated > 0 ? `${kpis.escalated} now` : undefined
            }
          />
          <KpiCard label="Overdue" value={kpis.overdue} icon={<AlertTriangle className="w-5 h-5 text-destructive" />} highlight={kpis.overdue > 0} />
          <KpiCard label="Improvement Rate" value={`${kpis.improvementRate}%`} icon={<TrendingUp className="w-5 h-5 text-primary" />} />
        </motion.div>

        {/* Admin analytics */}
        {isAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Evaluation Outcomes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 rounded-md bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">Improved</span>
                  </div>
                  <span className="text-xl font-bold text-green-600">{kpis.improved}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2">
                    <ThumbsDown className="w-4 h-4 text-destructive" />
                    <span className="text-sm font-medium">Not Improved</span>
                  </div>
                  <span className="text-xl font-bold text-destructive">{kpis.notImproved}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 border border-border">
                  <span className="text-sm font-medium">Total Plans</span>
                  <span className="text-xl font-bold">{kpis.total}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="plans" className="space-y-4">
          <TabsList>
            <TabsTrigger value="plans" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Plans
            </TabsTrigger>
            <TabsTrigger value="tutors" className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Tutors
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-4">
            {/* Category cards (click to filter) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <CategoryCountCard
                label="All"
                breakdown={categoryCounts.all}
                active={categoryFilter === "all"}
                onClick={() => setCategoryFilter("all")}
                styleClass="bg-muted/40 text-foreground border-border"
                activeClass="ring-2 ring-primary"
              />
              {(Object.keys(CATEGORY_LABELS) as ActionPlanCategory[])
                .filter((c) => c !== "leaves_abuse" || categoryCounts[c].total > 0)
                .map((c) => (
                  <CategoryCountCard
                    key={c}
                    label={CATEGORY_LABELS[c]}
                    breakdown={categoryCounts[c]}
                    active={categoryFilter === c}
                    onClick={() => setCategoryFilter(c)}
                    styleClass={CATEGORY_CARD_STYLES[c]}
                    activeClass="ring-2 ring-primary"
                  />
                ))}
            </div>

            {/* Filters */}
            <div className="bg-card rounded-lg border border-border p-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search tutor or ID..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {(Object.keys(STATUS_LABELS) as ActionPlanStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {(Object.keys(CATEGORY_LABELS) as ActionPlanCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <Select value={tlFilter} onValueChange={setTlFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Team Leader" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Team Leaders</SelectItem>
                    {teamLeaders.map((tl) => (
                      <SelectItem key={tl} value={tl}>{tl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {isAdmin && (
                <Select value={stepFilter} onValueChange={setStepFilter}>
                  <SelectTrigger className="w-[220px]"><SelectValue placeholder="First step" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All first-step states ({stepCounts.all})</SelectItem>
                    <SelectItem value="pending">⚠️ Awaiting first step ({stepCounts.pending})</SelectItem>
                    <SelectItem value="in_progress">In progress / no template ({stepCounts.in_progress})</SelectItem>
                    <SelectItem value="done">✅ Step 1 done ({stepCounts.done})</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* List */}
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <h3 className="font-semibold mb-1">No action plans</h3>
                  <p className="text-sm text-muted-foreground">Click "New Plan" to create the first one.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((plan) => {
                  const overdue = plan.status !== "resolved" && isAfter(today, new Date(plan.due_date));
                  const canDelete = isAdmin;
                  return (
                    <motion.div
                      key={plan.id}
                      className="relative bg-card rounded-lg border border-border hover:border-primary/40 hover:shadow-md transition-all"
                      whileHover={{ y: -2 }}
                    >
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlanToDelete(plan);
                          }}
                          title="Delete action plan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <button
                        onClick={() => setSelected(plan)}
                        className="text-left w-full p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2 pr-7">
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">{plan.tutor_name}</h3>
                            <p className="text-xs text-muted-foreground truncate">
                              {plan.tutor_external_id ? `${plan.tutor_external_id} · ` : ""}{plan.team_leader}
                            </p>
                          </div>
                          <StatusBadge status={plan.status} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CategoryBadge category={plan.category} />
                          <FirstStepBadge
                            category={plan.category}
                            notes={stepSummaries[plan.id]?.notes ?? []}
                            totalSteps={stepSummaries[plan.id]?.count ?? 0}
                          />
                          {overdue && (
                            <span className="text-xs text-destructive flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Overdue
                            </span>
                          )}
                          {plan.evaluation && (
                            <span className={`text-xs flex items-center gap-1 ${plan.evaluation === "improved" ? "text-green-600" : "text-destructive"}`}>
                              {plan.evaluation === "improved" ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                              {plan.evaluation === "improved" ? "Improved" : "Not Improved"}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-semibold">{plan.progress}%</span>
                          </div>
                          <Progress value={plan.progress} className="h-1.5" />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                          <span>Start: {format(new Date(plan.start_date), "MMM d")}</span>
                          <span>Due: {format(new Date(plan.due_date), "MMM d, yyyy")}</span>
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tutors">
            <TutorsTab plans={plans} isAdmin={isAdmin} onSelectPlan={setSelected} stepSummaries={stepSummaries} teamLeaders={teamLeaders} />
          </TabsContent>
        </Tabs>

      </main>

      <CreateActionPlanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refetch}
        isAdmin={isAdmin}
        currentTeamLeader={currentTL}
      />
      <ActionPlanDetailDialog
        plan={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        onChanged={() => { refetch(); refetchSummaries(); }}
        onDelete={(p) => setPlanToDelete(p)}
        canDelete={isAdmin}
      />
      <AlertDialog open={!!planToDelete} onOpenChange={(v) => !v && !deleting && setPlanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this action plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the plan for <strong>{planToDelete?.tutor_name}</strong> and all of its timeline updates. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const KpiCard = ({ label, value, icon, highlight }: { label: string; value: number | string; icon: React.ReactNode; highlight?: boolean }) => (
  <Card className={highlight ? "border-destructive/50" : ""}>
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${highlight ? "text-destructive" : ""}`}>{value}</p>
        </div>
        {icon}
      </div>
    </CardContent>
  </Card>
);

const CATEGORY_CARD_STYLES: Record<ActionPlanCategory, string> = {
  quality: "bg-primary/10 text-primary border-primary/20",
  emergency_abuse: "bg-red-500/10 text-red-700 border-red-500/30",
  no_show_abuse: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  communication: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  cs_complaints: "bg-pink-500/10 text-pink-700 border-pink-500/30",
  leaves_abuse: "bg-orange-500/10 text-orange-700 border-orange-500/30",
};

const CategoryCountCard = ({
  label, breakdown, active, onClick, styleClass, activeClass,
}: {
  label: string;
  breakdown: { total: number; active: number; on_hold: number; resolved: number; escalated: number };
  active: boolean;
  onClick: () => void;
  styleClass: string;
  activeClass: string;
}) => {
  const segments: { key: string; label: string; value: number; cls: string }[] = [
    { key: "active", label: "active", value: breakdown.active, cls: "text-blue-600" },
    { key: "escalated", label: "escalated", value: breakdown.escalated, cls: "text-destructive" },
    { key: "on_hold", label: "on hold", value: breakdown.on_hold, cls: "text-yellow-700" },
    { key: "resolved", label: "resolved", value: breakdown.resolved, cls: "text-green-700" },
  ].filter((s) => s.value > 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition-all hover:shadow-md hover:-translate-y-0.5 ${styleClass} ${active ? activeClass : ""}`}
    >
      <p className="text-xs font-medium opacity-80 truncate">{label}</p>
      <p className="text-2xl font-bold leading-tight">{breakdown.total}</p>
      <div className="mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] leading-tight min-h-[14px]">
        {segments.length === 0 ? (
          <span className="opacity-60">—</span>
        ) : (
          segments.map((s, i) => (
            <span key={s.key} className={s.cls}>
              {s.value} {s.label}{i < segments.length - 1 ? " ·" : ""}
            </span>
          ))
        )}
      </div>
    </button>
  );
};

interface TutorRow {
  key: string;
  tutor_name: string;
  tutor_external_id: string | null;
  team_leader: string;
  total: number;
  active: number;
  resolved: number;
  escalated: number;
  /** Total historical escalation events across this tutor's plans (a plan re-escalated counts twice). */
  escalation_events: number;
  on_hold: number;
  improved: number;
  not_improved: number;
  plans: ActionPlan[];
}

const TutorsTab = ({
  plans,
  isAdmin,
  onSelectPlan,
  stepSummaries,
  teamLeaders,
}: {
  plans: ActionPlan[];
  isAdmin: boolean;
  onSelectPlan: (p: ActionPlan) => void;
  stepSummaries: Record<string, PlanStepSummary>;
  teamLeaders: string[];
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tlFilter, setTlFilter] = useState<string>("all");
  const [stepFilter, setStepFilter] = useState<string>("all");
  const [openTutor, setOpenTutor] = useState<TutorRow | null>(null);

  // Plans matching status/TL/step filters (NOT category — category cards show breakdown across these)
  const planPoolPreCategory = useMemo(() => {
    return plans.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (tlFilter !== "all" && p.team_leader !== tlFilter) return false;
      if (stepFilter !== "all") {
        const summary = stepSummaries[p.id];
        const notes = summary?.notes ?? [];
        const total = summary?.count ?? 0;
        const done = isFirstStepDone(p.category, notes);
        const variant: "pending" | "in_progress" | "done" =
          done ? "done" : total > 0 ? "in_progress" : "pending";
        if (variant !== stepFilter) return false;
      }
      return true;
    });
  }, [plans, statusFilter, tlFilter, stepFilter, stepSummaries]);

  // Final plan pool also applies category filter
  const filteredPlans = useMemo(
    () => planPoolPreCategory.filter((p) => categoryFilter === "all" || p.category === categoryFilter),
    [planPoolPreCategory, categoryFilter],
  );

  // Category cards breakdown over the pre-category pool
  const categoryCounts = useMemo(() => {
    const empty = () => ({ total: 0, active: 0, on_hold: 0, resolved: 0, escalated: 0 });
    const counts: Record<string, ReturnType<typeof empty>> = { all: empty() };
    for (const c of Object.keys(CATEGORY_LABELS)) counts[c] = empty();
    for (const p of planPoolPreCategory) {
      counts.all.total += 1;
      counts.all[p.status] += 1;
      const c = counts[p.category];
      if (c) {
        c.total += 1;
        c[p.status] += 1;
      }
    }
    return counts;
  }, [planPoolPreCategory]);

  // First-step counts (over status/category/TL filtered pool, ignoring step filter itself)
  const stepCountsPool = useMemo(() => {
    return plans.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (tlFilter !== "all" && p.team_leader !== tlFilter) return false;
      return true;
    });
  }, [plans, statusFilter, categoryFilter, tlFilter]);

  const stepCounts = useMemo(() => {
    const counts = { all: stepCountsPool.length, pending: 0, in_progress: 0, done: 0 };
    for (const p of stepCountsPool) {
      const s = stepSummaries[p.id];
      const notes = s?.notes ?? [];
      const total = s?.count ?? 0;
      const done = isFirstStepDone(p.category, notes);
      const variant: "pending" | "in_progress" | "done" = done ? "done" : total > 0 ? "in_progress" : "pending";
      counts[variant] += 1;
    }
    return counts;
  }, [stepCountsPool, stepSummaries]);

  // Aggregate filtered plans by tutor
  const rows = useMemo<TutorRow[]>(() => {
    const map = new Map<string, TutorRow>();
    for (const p of filteredPlans) {
      const key = `${p.tutor_external_id ?? "noid"}::${p.tutor_name}::${p.team_leader}`;
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          tutor_name: p.tutor_name,
          tutor_external_id: p.tutor_external_id,
          team_leader: p.team_leader,
          total: 0, active: 0, resolved: 0, escalated: 0, escalation_events: 0, on_hold: 0,
          improved: 0, not_improved: 0,
          plans: [],
        };
        map.set(key, row);
      }
      row.total += 1;
      if (p.status === "active") row.active += 1;
      else if (p.status === "resolved") row.resolved += 1;
      else if (p.status === "escalated") row.escalated += 1;
      else if (p.status === "on_hold") row.on_hold += 1;
      row.escalation_events += stepSummaries[p.id]?.escalationCount ?? 0;
      if (p.evaluation === "improved") row.improved += 1;
      else if (p.evaluation === "not_improved") row.not_improved += 1;
      row.plans.push(p);
    }
    const arr = Array.from(map.values()).sort((a, b) => b.total - a.total || a.tutor_name.localeCompare(b.tutor_name));
    if (!search.trim()) return arr;
    const q = search.toLowerCase();
    return arr.filter(
      (r) =>
        r.tutor_name.toLowerCase().includes(q) ||
        (r.tutor_external_id ?? "").toLowerCase().includes(q) ||
        r.team_leader.toLowerCase().includes(q),
    );
  }, [filteredPlans, search, stepSummaries]);

  const today = new Date();

  return (
    <div className="space-y-4">
      {/* Category cards (click to filter) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <CategoryCountCard
          label="All"
          breakdown={categoryCounts.all}
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
          styleClass="bg-muted/40 text-foreground border-border"
          activeClass="ring-2 ring-primary"
        />
        {(Object.keys(CATEGORY_LABELS) as ActionPlanCategory[])
          .filter((c) => c !== "leaves_abuse" || categoryCounts[c].total > 0)
          .map((c) => (
            <CategoryCountCard
              key={c}
              label={CATEGORY_LABELS[c]}
              breakdown={categoryCounts[c]}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
              styleClass={CATEGORY_CARD_STYLES[c]}
              activeClass="ring-2 ring-primary"
            />
          ))}
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border border-border p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tutor, ID, or team leader..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {(Object.keys(STATUS_LABELS) as ActionPlanStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {(Object.keys(CATEGORY_LABELS) as ActionPlanCategory[]).map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={tlFilter} onValueChange={setTlFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Team Leader" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Team Leaders</SelectItem>
              {teamLeaders.map((tl) => (
                <SelectItem key={tl} value={tl}>{tl}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {isAdmin && (
          <Select value={stepFilter} onValueChange={setStepFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="First step" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All first-step states ({stepCounts.all})</SelectItem>
              <SelectItem value="pending">⚠️ Awaiting first step ({stepCounts.pending})</SelectItem>
              <SelectItem value="in_progress">In progress / no template ({stepCounts.in_progress})</SelectItem>
              <SelectItem value="done">✅ Step 1 done ({stepCounts.done})</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Badge variant="outline" className="font-medium">
          {rows.length} tutor{rows.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">No tutors match these filters</h3>
            <p className="text-sm text-muted-foreground">Try clearing filters or adjusting the search.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tutor</TableHead>
                  {isAdmin && <TableHead>Team Leader</TableHead>}
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  {categoryFilter === "all" ? (
                    <>
                      <TableHead className="text-center">First Step</TableHead>
                      <TableHead className="text-center">Resolved</TableHead>
                      <TableHead className="text-center">Escalated</TableHead>
                      <TableHead className="text-center">Improved / Not</TableHead>
                    </>
                  ) : (
                    <>
                      {(CATEGORY_COLUMNS[categoryFilter as ActionPlanCategory] ?? []).map((col) => (
                        <TableHead key={col.header} className="text-center whitespace-nowrap">
                          {col.header}
                        </TableHead>
                      ))}
                      <TableHead className="text-center">Resolved</TableHead>
                    </>
                  )}
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.key}
                    className="cursor-pointer"
                    onClick={() => setOpenTutor(r)}
                  >
                    <TableCell>
                      <div className="font-medium">{r.tutor_name}</div>
                      {r.tutor_external_id && (
                        <div className="text-xs text-muted-foreground">{r.tutor_external_id}</div>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-sm text-muted-foreground">{r.team_leader}</TableCell>
                    )}
                    <TableCell className="text-center font-semibold">{r.total}</TableCell>
                    <TableCell className="text-center">
                      {r.active > 0 ? (
                        <Badge variant="outline" className="bg-blue-500/15 text-blue-600 border-blue-500/30">{r.active}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    {categoryFilter === "all" ? (
                      <>
                        <TableCell className="text-center">
                          <TutorFirstStepCell plans={r.plans} stepSummaries={stepSummaries} />
                        </TableCell>
                        <TableCell className="text-center">
                          {r.resolved > 0 ? (
                            <Badge variant="outline" className="bg-green-500/15 text-green-700 border-green-500/30">{r.resolved}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.escalation_events > 0 || r.escalated > 0 ? (
                            <span
                              className="inline-flex items-center gap-1"
                              title={
                                r.escalation_events > r.escalated
                                  ? `${r.escalation_events} total escalation${r.escalation_events === 1 ? "" : "s"} · ${r.escalated} currently escalated`
                                  : `${r.escalated} currently escalated`
                              }
                            >
                              <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">
                                {Math.max(r.escalation_events, r.escalated)}
                                {r.escalation_events > 1 && <span className="ml-0.5">×</span>}
                              </Badge>
                              {r.escalated > 0 && r.escalation_events > r.escalated && (
                                <span className="text-[10px] text-muted-foreground">({r.escalated} now)</span>
                              )}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center text-sm whitespace-nowrap">
                          <span className="text-green-600 font-medium">{r.improved}</span>
                          <span className="text-muted-foreground"> / </span>
                          <span className="text-destructive font-medium">{r.not_improved}</span>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        {(CATEGORY_COLUMNS[categoryFilter as ActionPlanCategory] ?? []).map((col) => {
                          if (col.header === "Evaluation") {
                            return (
                              <TableCell key={col.header} className="text-center">
                                <EvaluationCell plans={r.plans} />
                              </TableCell>
                            );
                          }
                          const v = col.compute(r.plans, stepSummaries);
                          return (
                            <TableCell key={col.header} className="text-center">
                              <MilestoneCell done={v.done} total={v.total} tone={v.tone} />
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center">
                          {r.resolved > 0 ? (
                            <Badge variant="outline" className="bg-green-500/15 text-green-700 border-green-500/30">{r.resolved}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <TutorPlansDialog
        tutor={openTutor}
        open={!!openTutor}
        onOpenChange={(v) => !v && setOpenTutor(null)}
        onSelectPlan={(p) => {
          setOpenTutor(null);
          onSelectPlan(p);
        }}
        today={today}
        stepSummaries={stepSummaries}
      />
    </div>
  );
};

const TutorPlansDialog = ({
  tutor,
  open,
  onOpenChange,
  onSelectPlan,
  today,
  stepSummaries,
}: {
  tutor: TutorRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelectPlan: (p: ActionPlan) => void;
  today: Date;
  stepSummaries: Record<string, PlanStepSummary>;
}) => {
  if (!tutor) return null;
  const sorted = [...tutor.plans].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            {tutor.tutor_name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {tutor.tutor_external_id ? `${tutor.tutor_external_id} · ` : ""}{tutor.team_leader} · {tutor.total} plan{tutor.total === 1 ? "" : "s"}
          </p>
        </DialogHeader>
        <div className="space-y-3">
          {sorted.map((p) => {
            const overdue = p.status !== "resolved" && isAfter(today, new Date(p.due_date));
            return (
              <button
                key={p.id}
                onClick={() => onSelectPlan(p)}
                className="w-full text-left bg-card rounded-lg border border-border hover:border-primary/40 hover:shadow-sm transition-all p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CategoryBadge category={p.category} />
                    <StatusBadge status={p.status} />
                    <FirstStepBadge
                      category={p.category}
                      notes={stepSummaries[p.id]?.notes ?? []}
                      totalSteps={stepSummaries[p.id]?.count ?? 0}
                    />
                    {overdue && (
                      <span className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Overdue
                      </span>
                    )}
                    {p.evaluation && (
                      <span className={`text-xs flex items-center gap-1 ${p.evaluation === "improved" ? "text-green-600" : "text-destructive"}`}>
                        {p.evaluation === "improved" ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                        {p.evaluation === "improved" ? "Improved" : "Not Improved"}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
                {p.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{p.summary}</p>
                )}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold">{p.progress}%</span>
                  </div>
                  <Progress value={p.progress} className="h-1.5" />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                  <span>Start: {format(new Date(p.start_date), "MMM d, yyyy")}</span>
                  <span>Due: {format(new Date(p.due_date), "MMM d, yyyy")}</span>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Aggregates first-step status across all of a tutor's plans (preferring active ones).
 * Shows the "worst" badge: pending > in_progress > done. Includes a "+N" hint when
 * the tutor has more than one plan in that state.
 */
const TutorFirstStepCell = ({
  plans,
  stepSummaries,
}: {
  plans: ActionPlan[];
  stepSummaries: Record<string, PlanStepSummary>;
}) => {
  // Prefer active/on_hold/escalated plans (i.e. not resolved). Fall back to all.
  const open = plans.filter((p) => p.status !== "resolved");
  const pool = open.length > 0 ? open : plans;
  if (pool.length === 0) return <span className="text-muted-foreground">—</span>;

  // Pick worst: pending → in_progress → done
  const ranked = pool
    .map((p) => {
      const s = stepSummaries[p.id];
      const notes = s?.notes ?? [];
      const total = s?.count ?? 0;
      const done = isFirstStepDone(p.category, notes);
      const variant = done ? 2 : total > 0 ? 1 : 0; // 0 worst → pending
      return { plan: p, variant };
    })
    .sort((a, b) => a.variant - b.variant);

  const worst = ranked[0];
  const sameCount = ranked.filter((r) => r.variant === worst.variant).length;

  return (
    <div className="inline-flex items-center gap-1">
      <FirstStepBadge
        category={worst.plan.category}
        notes={stepSummaries[worst.plan.id]?.notes ?? []}
        totalSteps={stepSummaries[worst.plan.id]?.count ?? 0}
      />
      {sameCount > 1 && (
        <span className="text-[10px] text-muted-foreground">×{sameCount}</span>
      )}
    </div>
  );
};

export default ActionPlans;
