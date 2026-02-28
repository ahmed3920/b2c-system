import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminView } from "@/hooks/useAdminView";
import { AdminViewSelector } from "@/components/admin/AdminViewSelector";
import { Logo } from "@/components/Logo";
import {
  ArrowLeft, Loader2, FileText, Download, Calendar,
  TrendingUp, Users, BarChart3, PieChart as PieChartIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const COLORS = ["#056eec", "#fe7f1b", "#5dcb8d", "#798d99", "#d63031", "#00b0ff"];

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  roles: ("admin" | "team_leader" | "mentor" | "community_moderator")[];
}

const reportTypes: ReportType[] = [
  { id: "personal", title: "Personal Performance", description: "Task completion and productivity", icon: <TrendingUp className="w-6 h-6" />, roles: ["admin", "team_leader", "mentor", "community_moderator"] },
  { id: "team", title: "Team Summary", description: "Team performance and distribution", icon: <Users className="w-6 h-6" />, roles: ["admin", "team_leader"] },
  { id: "task_analysis", title: "Task Analysis", description: "Breakdown of task types and status", icon: <BarChart3 className="w-6 h-6" />, roles: ["admin", "team_leader", "mentor", "community_moderator"] },
  { id: "time_based", title: "Time-Based Report", description: "Daily, weekly, monthly summaries", icon: <Calendar className="w-6 h-6" />, roles: ["admin", "team_leader", "mentor", "community_moderator"] },
];

const Reports = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<string>("personal");
  const [dateRange, setDateRange] = useState<"week" | "month" | "quarter" | "year">("month");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, isAdmin, isTeamLeader } = useUserRole();
  const adminView = useAdminView();

  const displayTasks = isAdmin && adminView.viewMode !== "my" ? adminView.tasks : tasks;

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }

      const { data } = await supabase.from("tasks").select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (data) setTasks(data);
      setIsLoading(false);
    };
    fetchData();
  }, [navigate]);

  const getDateFilter = () => {
    const now = new Date();
    const ms = { week: 7, month: 30, quarter: 90, year: 365 }[dateRange] * 24 * 60 * 60 * 1000;
    return new Date(now.getTime() - ms);
  };

  const filteredTasks = displayTasks.filter(t => new Date(t.created_at) >= getDateFilter());

  const getStatusData = () => {
    const statuses = ["todo", "in_progress", "done", "archived"];
    return statuses.map(status => ({
      name: status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()),
      value: filteredTasks.filter(t => t.status === status).length,
    }));
  };

  const getTypeData = () => {
    const types: Record<string, number> = {};
    filteredTasks.forEach(task => { types[task.task_type] = (types[task.task_type] || 0) + 1; });
    return Object.entries(types).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  };

  const getMetrics = () => {
    const completed = filteredTasks.filter(t => t.status === "done").length;
    const total = filteredTasks.filter(t => t.status !== "archived").length;
    return {
      total: filteredTasks.length,
      completed,
      inProgress: filteredTasks.filter(t => t.status === "in_progress").length,
      todo: filteredTasks.filter(t => t.status === "todo").length,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  };

  const handleExport = (format: "csv" | "pdf") => {
    if (format === "csv") {
      const headers = ["Task ID", "Type", "Description", "Status", "Created At", "Date From", "Date To"];
      const rows = filteredTasks.map(t => [
        t.id, t.task_type, t.description.replace(/,/g, ";"), t.status, t.created_at, t.date_from || "", t.date_to || "",
      ]);
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${dateRange}_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      toast({ title: "Export Complete", description: "Your report has been downloaded as CSV." });
    } else {
      toast({ title: "PDF Export", description: "PDF export coming soon!" });
    }
  };

  const filteredReportTypes = reportTypes.filter(r => role && r.roles.includes(role));
  const metrics = getMetrics();
  const statusData = getStatusData();
  const typeData = getTypeData();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const viewLabel = isAdmin && adminView.viewMode !== "my" && adminView.selectedProfile
    ? `${adminView.selectedProfile.full_name || adminView.selectedProfile.mentor_name}'s`
    : adminView.viewMode === "all" && isAdmin ? "System-wide" : "Your";

  return (
    <div className="min-h-screen bg-gradient-hero">
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/home")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="h-6 w-px bg-border" />
              <Logo variant="blue" className="h-8" />
              <h1 className="font-bold text-lg text-foreground">Reports & Analytics</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Admin View Selector */}
        {isAdmin && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <AdminViewSelector
              viewMode={adminView.viewMode}
              onViewModeChange={adminView.setViewMode}
              selectedUserId={adminView.selectedUserId}
              onSelectedUserChange={adminView.setSelectedUserId}
              teamLeaders={adminView.teamLeaders}
              mentors={adminView.mentors}
              selectedProfile={adminView.selectedProfile}
            />
          </motion.div>
        )}

        {isAdmin && adminView.isLoadingTasks && adminView.viewMode !== "my" ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Report Type Selection */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {filteredReportTypes.map((report, index) => (
                <motion.button
                  key={report.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedReport(report.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedReport === report.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="text-primary mb-2">{report.icon}</div>
                  <h3 className="font-semibold text-foreground text-sm">{report.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
                </motion.button>
              ))}
            </div>

            {/* Date Range Filter */}
            <div className="flex gap-2 mb-6">
              {(["week", "month", "quarter", "year"] as const).map((range) => (
                <Button key={range} variant={dateRange === range ? "default" : "outline"} size="sm" onClick={() => setDateRange(range)}>
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Button>
              ))}
            </div>

            {/* Metrics Summary */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-card rounded-xl p-4 shadow-lg">
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold text-foreground">{metrics.total}</p>
              </div>
              <div className="bg-card rounded-xl p-4 shadow-lg">
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">{metrics.completed}</p>
              </div>
              <div className="bg-card rounded-xl p-4 shadow-lg">
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">{metrics.inProgress}</p>
              </div>
              <div className="bg-card rounded-xl p-4 shadow-lg">
                <p className="text-sm text-muted-foreground">To-Do</p>
                <p className="text-2xl font-bold text-orange-500">{metrics.todo}</p>
              </div>
              <div className="bg-card rounded-xl p-4 shadow-lg">
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold text-primary">{metrics.completionRate}%</p>
              </div>
            </motion.div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <PieChartIcon className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Status Distribution</h3>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {statusData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Top Task Types</h3>
                </div>
                {typeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={typeData} layout="vertical">
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      <Tooltip />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">No task data available</div>
                )}
              </motion.div>
            </div>

            {/* Report Summary */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl p-6 shadow-lg mt-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">{viewLabel} Report Summary</h3>
              </div>
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <p>
                  During the selected <strong>{dateRange}</strong> period, there are{" "}
                  <strong>{metrics.total}</strong> tasks in total with a{" "}
                  <strong>{metrics.completionRate}%</strong> completion rate.
                </p>
                {metrics.completed > 0 && (
                  <p>
                    <strong>{metrics.completed}</strong> tasks completed.
                    {typeData.length > 0 && (
                      <> Most common type: <strong>{typeData[0]?.name}</strong> ({typeData[0]?.value} tasks).</>
                    )}
                  </p>
                )}
                {metrics.inProgress > 0 && (
                  <p>
                    <strong>{metrics.inProgress}</strong> tasks in progress and <strong>{metrics.todo}</strong> in the to-do list.
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </main>
    </div>
  );
};

export default Reports;
