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
import { Logo } from "@/components/Logo";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Loader2, Plus, Search, ClipboardList, AlertTriangle, CheckCircle2, Clock, PauseCircle, Flame, TrendingUp, ThumbsUp, ThumbsDown, Users, ChevronRight,
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

const ActionPlans = () => {
  const navigate = useNavigate();
  const { isAdmin, isTeamLeader, isLoading: roleLoading } = useUserRole();
  const { plans, isLoading, refetch } = useActionPlans();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ActionPlan | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [tlFilter, setTlFilter] = useState<string>("all");
  const [currentTL, setCurrentTL] = useState<string | null>(null);

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
      if (search) {
        const q = search.toLowerCase();
        if (!p.tutor_name.toLowerCase().includes(q) && !(p.tutor_external_id ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [plans, statusFilter, categoryFilter, tlFilter, search]);

  const today = new Date();
  const kpis = useMemo(() => {
    const active = plans.filter((p) => p.status === "active").length;
    const onHold = plans.filter((p) => p.status === "on_hold").length;
    const resolved = plans.filter((p) => p.status === "resolved").length;
    const escalated = plans.filter((p) => p.status === "escalated").length;
    const overdue = plans.filter((p) => p.status !== "resolved" && isAfter(today, new Date(p.due_date))).length;
    const improved = plans.filter((p) => p.evaluation === "improved").length;
    const notImproved = plans.filter((p) => p.evaluation === "not_improved").length;
    const evaluated = improved + notImproved;
    const improvementRate = evaluated > 0 ? Math.round((improved / evaluated) * 100) : 0;
    return { active, onHold, resolved, escalated, overdue, improved, notImproved, improvementRate, total: plans.length };
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
              <Button variant="ghost" size="icon" onClick={() => navigate(isAdmin ? "/admin/dashboard" : "/team/dashboard")}>
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
          <KpiCard label="Escalated" value={kpis.escalated} icon={<Flame className="w-5 h-5 text-destructive" />} />
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
                  return (
                    <motion.button
                      key={plan.id}
                      onClick={() => setSelected(plan)}
                      className="text-left bg-card rounded-lg border border-border hover:border-primary/40 hover:shadow-md transition-all p-4 space-y-3"
                      whileHover={{ y: -2 }}
                    >
                      <div className="flex items-start justify-between gap-2">
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
                    </motion.button>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tutors">
            <TutorsTab plans={plans} isAdmin={isAdmin} onSelectPlan={setSelected} />
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
        onChanged={() => { refetch(); /* keep dialog open with fresh data via refetch effect */ }}
      />
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

export default ActionPlans;
