import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { RoleBadge } from "@/components/RoleBadge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Users,
  CheckCircle,
  Clock,
  TrendingUp,
  Activity,
  Shield,
  Database,
  Loader2,
  RefreshCw,
  UserCheck,
  Calendar,
  Target,
  Award,
  AlertTriangle,
  BarChart3,
  Plus,
  Settings2,
} from "lucide-react";
import { motion } from "framer-motion";
import { format, subDays, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { AdminTaskAssignDialog } from "@/components/admin/AdminTaskAssignDialog";
import { TaskFormConfigDialog } from "@/components/admin/TaskFormConfigDialog";

interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  totalAchievements: number;
  totalGoals: number;
  usersByRole: {
    admin: number;
    team_leader: number;
    mentor: number;
  };
  recentLogins: number;
  tasksCompletedThisWeek: number;
}

interface UserTaskStats {
  userId: string;
  userName: string;
  teamLeader: string;
  totalTasks: number;
  completed: number;
  inProgress: number;
  overdue: number;
  completionRate: number;
}

interface TeamStats {
  teamLeader: string;
  memberCount: number;
  totalTasks: number;
  completed: number;
  overdue: number;
  completionRate: number;
}

const monthOptions = [
  { value: "all", label: "All Time" },
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const SystemDashboard = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [userStats, setUserStats] = useState<UserTaskStats[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isFormConfigOpen, setIsFormConfigOpen] = useState(false);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      // Fetch all data in parallel
      const [profilesRes, rolesRes, tasksRes, achievementsRes, goalsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, active_status, last_login, mentor_name, team_leader"),
        supabase.from("user_roles").select("role, user_id"),
        supabase.from("tasks").select("status, created_at, user_id, date_to"),
        supabase.from("achievements").select("id"),
        supabase.from("goals").select("id"),
      ]);

      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];
      const tasks = tasksRes.data || [];
      const achievements = achievementsRes.data || [];
      const goals = goalsRes.data || [];

      // Filter tasks by month if selected
      const filteredTasks = selectedMonth && selectedMonth !== "all"
        ? tasks.filter(t => {
            const taskMonth = t.date_to?.substring(5, 7);
            return taskMonth === selectedMonth;
          })
        : tasks;

      // Calculate metrics
      const weekAgo = subDays(new Date(), 7);
      const today = new Date();
      
      const recentLogins = profiles.filter(
        (p) => p.last_login && new Date(p.last_login) > weekAgo
      ).length;

      const tasksCompletedThisWeek = filteredTasks.filter(
        (t) => t.status === "done" && new Date(t.created_at) > weekAgo
      ).length;

      const overdueTasks = filteredTasks.filter(t => {
        if (t.status === "done" || t.status === "archived" || !t.date_to) return false;
        return new Date(t.date_to) < today;
      }).length;

      const roleCount = {
        admin: roles.filter((r) => r.role === "admin").length,
        team_leader: roles.filter((r) => r.role === "team_leader").length,
        mentor: roles.filter((r) => r.role === "mentor").length,
      };

      setMetrics({
        totalUsers: profiles.length,
        activeUsers: profiles.filter((p) => p.active_status).length,
        totalTasks: filteredTasks.length,
        completedTasks: filteredTasks.filter((t) => t.status === "done").length,
        pendingTasks: filteredTasks.filter((t) => t.status === "todo").length,
        inProgressTasks: filteredTasks.filter((t) => t.status === "in_progress").length,
        overdueTasks,
        totalAchievements: achievements.length,
        totalGoals: goals.length,
        usersByRole: roleCount,
        recentLogins,
        tasksCompletedThisWeek,
      });

      // Calculate per-user stats
      const userStatsMap = new Map<string, UserTaskStats>();
      profiles.forEach(p => {
        const userTasks = filteredTasks.filter(t => t.user_id === p.user_id);
        const completed = userTasks.filter(t => t.status === "done").length;
        const overdue = userTasks.filter(t => {
          if (t.status === "done" || t.status === "archived" || !t.date_to) return false;
          return new Date(t.date_to) < today;
        }).length;

        userStatsMap.set(p.user_id, {
          userId: p.user_id,
          userName: p.mentor_name,
          teamLeader: p.team_leader,
          totalTasks: userTasks.length,
          completed,
          inProgress: userTasks.filter(t => t.status === "in_progress").length,
          overdue,
          completionRate: userTasks.length > 0 ? Math.round((completed / userTasks.length) * 100) : 0,
        });
      });
      setUserStats(Array.from(userStatsMap.values()).sort((a, b) => b.totalTasks - a.totalTasks));

      // Calculate per-team stats
      const teamStatsMap = new Map<string, TeamStats>();
      profiles.forEach(p => {
        if (!p.team_leader) return;
        const existing = teamStatsMap.get(p.team_leader) || {
          teamLeader: p.team_leader,
          memberCount: 0,
          totalTasks: 0,
          completed: 0,
          overdue: 0,
          completionRate: 0,
        };
        
        const userTasks = filteredTasks.filter(t => t.user_id === p.user_id);
        const completed = userTasks.filter(t => t.status === "done").length;
        const overdue = userTasks.filter(t => {
          if (t.status === "done" || t.status === "archived" || !t.date_to) return false;
          return new Date(t.date_to) < today;
        }).length;

        teamStatsMap.set(p.team_leader, {
          ...existing,
          memberCount: existing.memberCount + 1,
          totalTasks: existing.totalTasks + userTasks.length,
          completed: existing.completed + completed,
          overdue: existing.overdue + overdue,
          completionRate: 0,
        });
      });
      
      // Calculate completion rates
      teamStatsMap.forEach((stats, key) => {
        stats.completionRate = stats.totalTasks > 0 
          ? Math.round((stats.completed / stats.totalTasks) * 100) 
          : 0;
        teamStatsMap.set(key, stats);
      });
      
      setTeamStats(Array.from(teamStatsMap.values()).sort((a, b) => b.totalTasks - a.totalTasks));
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/home");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchMetrics();
    }
  }, [isAdmin, selectedMonth]);

  if (roleLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const completionRate = metrics?.totalTasks
    ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
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
                <Activity className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">System Dashboard</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[150px]">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchMetrics}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsFormConfigOpen(true)}>
                <Settings2 className="w-4 h-4 mr-2" />
                Task Form
              </Button>
              <Button size="sm" onClick={() => setIsAssignDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Assign Task
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* System Health Overview */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            System Health Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Database className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Database</p>
                    <p className="text-lg font-bold text-green-500">Healthy</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Activity className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">API Status</p>
                    <p className="text-lg font-bold text-blue-500">Online</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Shield className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Auth System</p>
                    <p className="text-lg font-bold text-purple-500">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completion</p>
                    <p className="text-lg font-bold text-orange-500">{completionRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                    <p className="text-lg font-bold text-red-500">{metrics?.overdueTasks || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        {/* User Adoption Stats */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            User & Task Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-3xl font-bold text-foreground">{metrics?.totalUsers || 0}</p>
                  </div>
                  <Users className="w-8 h-8 text-primary/50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tasks</p>
                    <p className="text-3xl font-bold text-foreground">{metrics?.totalTasks || 0}</p>
                  </div>
                  <Target className="w-8 h-8 text-primary/50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-3xl font-bold text-green-500">{metrics?.completedTasks || 0}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-500/50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                    <p className="text-3xl font-bold text-blue-500">{metrics?.inProgressTasks || 0}</p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-500/50" />
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        {/* Team Progress Tracking */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Team Progress Tracking
          </h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Progress by Team</CardTitle>
              <CardDescription>Task completion status across all teams</CardDescription>
            </CardHeader>
            <CardContent>
              {teamStats.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No team data available</p>
              ) : (
                <div className="space-y-6">
                  {teamStats.map((team) => (
                    <div key={team.teamLeader} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-foreground">{team.teamLeader}</span>
                          <span className="text-xs text-muted-foreground">
                            {team.memberCount} member{team.memberCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-green-600">{team.completed} done</span>
                          {team.overdue > 0 && (
                            <span className="text-destructive font-medium">{team.overdue} overdue</span>
                          )}
                          <span className="font-bold">{team.completionRate}%</span>
                        </div>
                      </div>
                      <Progress value={team.completionRate} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {team.completed} of {team.totalTasks} tasks completed
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.section>

        {/* Role Distribution & Individual Stats */}
        <div className="grid md:grid-cols-2 gap-6">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Role Distribution
                </CardTitle>
                <CardDescription>Users by role type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <RoleBadge role="admin" />
                    <span className="font-medium">Administrators</span>
                  </div>
                  <span className="text-2xl font-bold">{metrics?.usersByRole.admin || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <RoleBadge role="team_leader" />
                    <span className="font-medium">Team Leaders</span>
                  </div>
                  <span className="text-2xl font-bold">{metrics?.usersByRole.team_leader || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <RoleBadge role="mentor" />
                    <span className="font-medium">Mentors</span>
                  </div>
                  <span className="text-2xl font-bold">{metrics?.usersByRole.mentor || 0}</span>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary" />
                  Top Performers
                </CardTitle>
                <CardDescription>Users with highest task completion</CardDescription>
              </CardHeader>
              <CardContent>
                {userStats.filter(u => u.totalTasks > 0).length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No task data available</p>
                ) : (
                  <div className="space-y-3">
                    {userStats
                      .filter(u => u.totalTasks > 0)
                      .sort((a, b) => b.completionRate - a.completionRate)
                      .slice(0, 5)
                      .map((user, index) => (
                        <div key={user.userId} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {index + 1}
                            </span>
                            <div>
                              <p className="font-medium text-sm">{user.userName}</p>
                              <p className="text-xs text-muted-foreground">{user.completed}/{user.totalTasks} tasks</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {user.overdue > 0 && (
                              <span className="text-xs text-destructive">{user.overdue} overdue</span>
                            )}
                            <span className="font-bold text-green-600">{user.completionRate}%</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.section>
        </div>

        {/* Gamification Stats */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Gamification Stats
                </CardTitle>
                <CardDescription>Achievements and goals overview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Achievements Earned</p>
                    <p className="text-3xl font-bold text-yellow-500">
                      {metrics?.totalAchievements || 0}
                    </p>
                  </div>
                  <Award className="w-10 h-10 text-yellow-500/50" />
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Goals</p>
                    <p className="text-3xl font-bold text-blue-500">{metrics?.totalGoals || 0}</p>
                  </div>
                  <Target className="w-10 h-10 text-blue-500/50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Weekly Activity
                </CardTitle>
                <CardDescription>Activity in the last 7 days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
                  <div>
                    <p className="text-sm text-muted-foreground">Weekly Logins</p>
                    <p className="text-3xl font-bold text-green-500">{metrics?.recentLogins || 0}</p>
                  </div>
                  <UserCheck className="w-10 h-10 text-green-500/50" />
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
                  <div>
                    <p className="text-sm text-muted-foreground">Tasks Completed This Week</p>
                    <p className="text-3xl font-bold text-purple-500">{metrics?.tasksCompletedThisWeek || 0}</p>
                  </div>
                  <CheckCircle className="w-10 h-10 text-purple-500/50" />
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.section>
      </main>

      {/* Admin Task Assign Dialog */}
      <AdminTaskAssignDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        onTaskAssigned={fetchMetrics}
      />

      {/* Task Form Configuration Dialog */}
      <TaskFormConfigDialog
        open={isFormConfigOpen}
        onOpenChange={setIsFormConfigOpen}
      />
    </div>
  );
};

export default SystemDashboard;
