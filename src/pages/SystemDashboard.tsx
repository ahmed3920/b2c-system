import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { RoleBadge } from "@/components/RoleBadge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Loader2,
  RefreshCw,
  UserCheck,
  Target,
  AlertTriangle,
  BarChart3,
  Plus,
  Settings2,
  Search,
  ChevronRight,
  ArrowUpRight,
  Eye,
  Kanban,
  User,
  Calendar,
  Tags,
  ClipboardList,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { subDays, format } from "date-fns";
import { AdminTaskAssignDialog } from "@/components/admin/AdminTaskAssignDialog";
import { TaskFormConfigDialog } from "@/components/admin/TaskFormConfigDialog";
import { TaskCategoryManagerDialog } from "@/components/admin/TaskCategoryManagerDialog";
import { EngagementTab } from "@/components/engagement/EngagementTab";
import { Star } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  overdueTasks: number;
  totalTeamLeaders: number;
  totalMentors: number;
  totalAdmins: number;
  recentLogins: number;
  completionRate: number;
}

interface TeamStats {
  teamLeader: string;
  memberCount: number;
  totalTasks: number;
  completed: number;
  inProgress: number;
  overdue: number;
  completionRate: number;
}

interface MemberInfo {
  user_id: string;
  mentor_name: string;
  full_name: string | null;
  team_leader: string;
  email: string | null;
  active_status: boolean | null;
  role: string;
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
    overdue: number;
  };
}

const STATUS_COLORS = [
  "hsl(var(--status-todo))",
  "hsl(var(--status-in-progress))",
  "hsl(var(--status-done))",
  "hsl(var(--status-archived))",
];

const SystemDashboard = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isFormConfigOpen, setIsFormConfigOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTeamLeader, setFilterTeamLeader] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedTeamLeader, setSelectedTeamLeader] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberInfo | null>(null);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      const [profilesRes, rolesRes, teamStatsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, active_status, last_login, mentor_name, full_name, team_leader, email"),
        supabase.from("user_roles").select("role, user_id"),
        supabase.rpc("get_team_task_stats"),
      ]);

      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];
      const teamTaskStats = teamStatsRes.data || [];

      // Build role map (pick highest priority role per user)
      const roleMap = new Map<string, string>();
      roles.forEach((r) => {
        const existing = roleMap.get(r.user_id);
        if (!existing || r.role === "admin" || (r.role === "team_leader" && existing === "mentor")) {
          roleMap.set(r.user_id, r.role);
        }
      });

      const weekAgo = subDays(new Date(), 7);
      const recentLogins = profiles.filter(
        (p) => p.last_login && new Date(p.last_login) > weekAgo
      ).length;

      const adminCount = [...roleMap.values()].filter(r => r === "admin").length;
      const tlCount = [...roleMap.values()].filter(r => r === "team_leader").length;
      const mentorCount = [...roleMap.values()].filter(r => r === "mentor").length;

      let totalTasks = 0, completedTasks = 0, inProgressTasks = 0, overdueTasks = 0, todoTasks = 0;

      teamTaskStats.forEach((team: any) => {
        totalTasks += Number(team.total_tasks) || 0;
        completedTasks += Number(team.completed_tasks) || 0;
        inProgressTasks += Number(team.in_progress_tasks) || 0;
        overdueTasks += Number(team.overdue_tasks) || 0;
      });
      todoTasks = totalTasks - completedTasks - inProgressTasks;

      setMetrics({
        totalUsers: profiles.length,
        activeUsers: profiles.filter((p) => p.active_status).length,
        totalTasks,
        completedTasks,
        inProgressTasks,
        todoTasks: Math.max(0, todoTasks),
        overdueTasks,
        totalTeamLeaders: tlCount,
        totalMentors: mentorCount,
        totalAdmins: adminCount,
        recentLogins,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      });

      // Build team stats
      const teamMemberCount = new Map<string, number>();
      profiles.forEach((p) => {
        if (p.team_leader) {
          teamMemberCount.set(p.team_leader, (teamMemberCount.get(p.team_leader) || 0) + 1);
        }
      });

      const processedTeamStats: TeamStats[] = teamTaskStats.map((team: any) => ({
        teamLeader: team.team_leader,
        memberCount: teamMemberCount.get(team.team_leader) || 0,
        totalTasks: Number(team.total_tasks) || 0,
        completed: Number(team.completed_tasks) || 0,
        inProgress: Number(team.in_progress_tasks) || 0,
        overdue: Number(team.overdue_tasks) || 0,
        completionRate: team.total_tasks > 0
          ? Math.round((Number(team.completed_tasks) / Number(team.total_tasks)) * 100) : 0,
      }));

      setTeamStats(processedTeamStats.sort((a, b) => b.totalTasks - a.totalTasks));

      // Build member list with task stats from team aggregates
      const memberInfos: MemberInfo[] = profiles.map((p) => ({
        user_id: p.user_id,
        mentor_name: p.mentor_name,
        full_name: p.full_name,
        team_leader: p.team_leader,
        email: p.email,
        active_status: p.active_status,
        role: roleMap.get(p.user_id) || "mentor",
        taskStats: { total: 0, completed: 0, inProgress: 0, todo: 0, overdue: 0 },
      }));

      setMembers(memberInfos);
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate("/home");
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) fetchMetrics();
  }, [isAdmin]);

  // Derived data
  const uniqueTeamLeaders = useMemo(() => {
    return [...new Set(members.map(m => m.team_leader))].filter(Boolean).sort();
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!(m.full_name?.toLowerCase().includes(q) || m.mentor_name.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))) return false;
      }
      if (filterTeamLeader !== "all" && m.team_leader !== filterTeamLeader) return false;
      if (filterRole !== "all" && m.role !== filterRole) return false;
      return true;
    });
  }, [members, searchQuery, filterTeamLeader, filterRole]);

  const tasksByStatusData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: "To Do", value: metrics.todoTasks, fill: STATUS_COLORS[0] },
      { name: "In Progress", value: metrics.inProgressTasks, fill: STATUS_COLORS[1] },
      { name: "Done", value: metrics.completedTasks, fill: STATUS_COLORS[2] },
    ].filter(d => d.value > 0);
  }, [metrics]);

  const tasksByTeamData = useMemo(() => {
    return teamStats.map(t => ({
      name: t.teamLeader.length > 12 ? t.teamLeader.substring(0, 12) + "…" : t.teamLeader,
      fullName: t.teamLeader,
      Completed: t.completed,
      "In Progress": t.inProgress,
      Overdue: t.overdue,
    }));
  }, [teamStats]);

  if (roleLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Logo variant="blue" className="h-8" />
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">Admin Command Center</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchMetrics}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsFormConfigOpen(true)}>
                <Settings2 className="w-4 h-4 mr-2" />
                Task Form
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsCategoryManagerOpen(true)}>
                <Tags className="w-4 h-4 mr-2" />
                Categories
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/action-plans")}>
                <ClipboardList className="w-4 h-4 mr-2" />
                Action Plans
              </Button>
              <Button size="sm" onClick={() => setIsAssignDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Assign Task
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Metric Cards */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: "Total Users", value: metrics?.totalUsers || 0, icon: Users, color: "text-primary" },
              { label: "Team Leaders", value: metrics?.totalTeamLeaders || 0, icon: UserCheck, color: "text-amber-600" },
              { label: "Mentors", value: metrics?.totalMentors || 0, icon: User, color: "text-blue-600" },
              { label: "Active Tasks", value: (metrics?.todoTasks || 0) + (metrics?.inProgressTasks || 0), icon: Target, color: "text-primary" },
              { label: "Completed", value: metrics?.completedTasks || 0, icon: CheckCircle, color: "text-green-600" },
              { label: "In Progress", value: metrics?.inProgressTasks || 0, icon: Clock, color: "text-blue-500" },
              { label: "Overdue", value: metrics?.overdueTasks || 0, icon: AlertTriangle, color: "text-destructive" },
              { label: "Completion", value: `${metrics?.completionRate || 0}%`, icon: TrendingUp, color: "text-green-600" },
            ].map((kpi) => (
              <Card key={kpi.label} className="bg-card">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                    <span className="text-xs text-muted-foreground truncate">{kpi.label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>

        {/* Charts Row */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Task Status Pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tasks by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={tasksByStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                      {tasksByStatusData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tasks by Team Bar */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tasks by Team</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={tasksByTeamData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="Completed" fill="hsl(var(--status-done))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="In Progress" fill="hsl(var(--status-in-progress))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Overdue" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        {/* Main Content Tabs */}
        <Tabs defaultValue="teams" className="space-y-4">
          <TabsList>
            <TabsTrigger value="teams">
              <BarChart3 className="w-4 h-4 mr-2" />
              Teams Overview
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="w-4 h-4 mr-2" />
              All Members
            </TabsTrigger>
          </TabsList>

          {/* Teams Tab */}
          <TabsContent value="teams" className="space-y-4">
            <AnimatePresence mode="wait">
              {selectedTeamLeader ? (
                <motion.div
                  key="team-detail"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <TeamLeaderDetail
                    teamLeader={selectedTeamLeader}
                    teamStats={teamStats.find(t => t.teamLeader === selectedTeamLeader)}
                    members={members.filter(m => m.team_leader === selectedTeamLeader)}
                    onBack={() => setSelectedTeamLeader(null)}
                    onAssignTask={() => setIsAssignDialogOpen(true)}
                    onSelectMember={setSelectedMember}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="teams-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid gap-3"
                >
                  {teamStats.map((team) => (
                    <Card
                      key={team.teamLeader}
                      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                      onClick={() => setSelectedTeamLeader(team.teamLeader)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
                              {team.teamLeader.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{team.teamLeader}</span>
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                  Team Leader
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {team.memberCount} members · {team.totalTasks} tasks
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="hidden md:flex items-center gap-4 text-sm">
                              <span className="text-green-600 font-medium">{team.completed} done</span>
                              <span className="text-blue-600">{team.inProgress} active</span>
                              {team.overdue > 0 && (
                                <span className="text-destructive font-medium">{team.overdue} overdue</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-20">
                                <Progress value={team.completionRate} className="h-2" />
                              </div>
                              <span className="text-sm font-bold w-10 text-right">{team.completionRate}%</span>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterTeamLeader} onValueChange={setFilterTeamLeader}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {uniqueTeamLeaders.map(tl => (
                    <SelectItem key={tl} value={tl}>{tl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="team_leader">Team Leader</SelectItem>
                  <SelectItem value="mentor">Mentor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Members List */}
            <AnimatePresence mode="wait">
              {selectedMember ? (
                <motion.div
                  key="member-detail"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <MemberDetail
                    member={selectedMember}
                    onBack={() => setSelectedMember(null)}
                    onAssignTask={() => setIsAssignDialogOpen(true)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="members-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid gap-2"
                >
                  <p className="text-sm text-muted-foreground">{filteredMembers.length} member(s) found</p>
                  {filteredMembers.map((member) => (
                    <Card
                      key={member.user_id}
                      className="cursor-pointer transition-all hover:shadow-sm hover:border-primary/20"
                      onClick={() => setSelectedMember(member)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-sm font-medium text-foreground">
                              {(member.full_name || member.mentor_name).charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground text-sm">
                                  {member.full_name || member.mentor_name}
                                </span>
                                <RoleBadge role={member.role as any} size="sm" />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {member.email} · Team: {member.team_leader}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={member.active_status ? "default" : "secondary"} className="text-xs">
                              {member.active_status ? "Active" : "Inactive"}
                            </Badge>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        </Tabs>
      </main>

      <AdminTaskAssignDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        onTaskAssigned={fetchMetrics}
      />
      <TaskFormConfigDialog
        open={isFormConfigOpen}
        onOpenChange={setIsFormConfigOpen}
      />
      <TaskCategoryManagerDialog
        open={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
      />
    </div>
  );
};

// Team Leader Detail Component
function TeamLeaderDetail({
  teamLeader,
  teamStats,
  members,
  onBack,
  onAssignTask,
  onSelectMember,
}: {
  teamLeader: string;
  teamStats?: TeamStats;
  members: MemberInfo[];
  onBack: () => void;
  onAssignTask: () => void;
  onSelectMember: (m: MemberInfo) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            {teamLeader}
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              Team Leader
            </Badge>
          </h3>
        </div>
        <Button size="sm" onClick={onAssignTask}>
          <Plus className="w-4 h-4 mr-1" /> Assign Task
        </Button>
      </div>

      {/* Team Stats */}
      {teamStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Members</p>
              <p className="text-2xl font-bold text-foreground">{teamStats.memberCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Tasks</p>
              <p className="text-2xl font-bold text-foreground">{teamStats.totalTasks}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600">{teamStats.completed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold text-destructive">{teamStats.overdue}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Completion</p>
              <p className="text-2xl font-bold text-green-600">{teamStats.completionRate}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Team Members */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Team Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {members.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
              onClick={() => onSelectMember(m)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium text-primary">
                  {(m.full_name || m.mentor_name).charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{m.full_name || m.mentor_name}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RoleBadge role={m.role as any} size="sm" />
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// Member Detail Component
function MemberDetail({
  member,
  onBack,
  onAssignTask,
}: {
  member: MemberInfo;
  onBack: () => void;
  onAssignTask: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-gradient-primary rounded-full flex items-center justify-center text-xl font-bold text-primary-foreground">
              {(member.full_name || member.mentor_name).charAt(0)}
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                {member.full_name || member.mentor_name}
                <RoleBadge role={member.role as any} size="sm" />
              </h3>
              <p className="text-sm text-muted-foreground">{member.email}</p>
              <p className="text-sm text-muted-foreground">Team: {member.team_leader}</p>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={onAssignTask}>
              <Plus className="w-4 h-4 mr-1" /> Assign Task
            </Button>
            <Badge variant={member.active_status ? "default" : "secondary"}>
              {member.active_status ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SystemDashboard;
