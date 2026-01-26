import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { RoleBadge } from "@/components/RoleBadge";
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
} from "lucide-react";
import { motion } from "framer-motion";
import { format, subDays } from "date-fns";

interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
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

interface UserCredential {
  email: string;
  role: string;
  password: string;
}

const testCredentials: UserCredential[] = [
  { email: "admin@ischool.com", password: "Admin123!", role: "admin" },
  { email: "teamleader@ischool.com", password: "Leader123!", role: "team_leader" },
  { email: "mentor@ischool.com", password: "Mentor123!", role: "mentor" },
];

const SystemDashboard = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      // Fetch all data in parallel
      const [profilesRes, rolesRes, tasksRes, achievementsRes, goalsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, active_status, last_login"),
        supabase.from("user_roles").select("role"),
        supabase.from("tasks").select("status, created_at"),
        supabase.from("achievements").select("id"),
        supabase.from("goals").select("id"),
      ]);

      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];
      const tasks = tasksRes.data || [];
      const achievements = achievementsRes.data || [];
      const goals = goalsRes.data || [];

      // Calculate metrics
      const weekAgo = subDays(new Date(), 7);
      
      const recentLogins = profiles.filter(
        (p) => p.last_login && new Date(p.last_login) > weekAgo
      ).length;

      const tasksCompletedThisWeek = tasks.filter(
        (t) => t.status === "done" && new Date(t.created_at) > weekAgo
      ).length;

      const roleCount = {
        admin: roles.filter((r) => r.role === "admin").length,
        team_leader: roles.filter((r) => r.role === "team_leader").length,
        mentor: roles.filter((r) => r.role === "mentor").length,
      };

      setMetrics({
        totalUsers: profiles.length,
        activeUsers: profiles.filter((p) => p.active_status).length,
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t) => t.status === "done").length,
        pendingTasks: tasks.filter((t) => t.status === "todo").length,
        inProgressTasks: tasks.filter((t) => t.status === "in_progress").length,
        totalAchievements: achievements.length,
        totalGoals: goals.length,
        usersByRole: roleCount,
        recentLogins,
        tasksCompletedThisWeek,
      });
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
  }, [isAdmin]);

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
            <Button variant="outline" size="sm" onClick={fetchMetrics}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    <p className="text-sm text-muted-foreground">Completion Rate</p>
                    <p className="text-lg font-bold text-orange-500">{completionRate}%</p>
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
            User Adoption Statistics
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
                    <p className="text-sm text-muted-foreground">Active Users</p>
                    <p className="text-3xl font-bold text-green-500">{metrics?.activeUsers || 0}</p>
                  </div>
                  <UserCheck className="w-8 h-8 text-green-500/50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Weekly Logins</p>
                    <p className="text-3xl font-bold text-blue-500">{metrics?.recentLogins || 0}</p>
                  </div>
                  <Calendar className="w-8 h-8 text-blue-500/50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Tasks This Week</p>
                    <p className="text-3xl font-bold text-purple-500">
                      {metrics?.tasksCompletedThisWeek || 0}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-purple-500/50" />
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        {/* Role Distribution & Task Metrics */}
        <div className="grid md:grid-cols-2 gap-6">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
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
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Task Metrics
                </CardTitle>
                <CardDescription>Overall task statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    <span className="font-medium">Pending</span>
                  </div>
                  <span className="text-2xl font-bold text-yellow-500">
                    {metrics?.pendingTasks || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-blue-500" />
                    <span className="font-medium">In Progress</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-500">
                    {metrics?.inProgressTasks || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-medium">Completed</span>
                  </div>
                  <span className="text-2xl font-bold text-green-500">
                    {metrics?.completedTasks || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.section>
        </div>

        {/* Gamification Stats & Test Credentials */}
        <div className="grid md:grid-cols-2 gap-6">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
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
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Test Credentials
                </CardTitle>
                <CardDescription>Use these accounts for testing (development only)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {testCredentials.map((cred) => (
                  <div
                    key={cred.email}
                    className="p-3 bg-muted rounded-lg space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{cred.email}</span>
                      <RoleBadge role={cred.role as any} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Password:</span>
                      <code className="text-xs bg-background px-2 py-1 rounded">
                        {cred.password}
                      </code>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.section>
        </div>
      </main>
    </div>
  );
};

export default SystemDashboard;
