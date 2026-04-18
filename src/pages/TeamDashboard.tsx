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
  Loader2,
  Users,
  ClipboardList,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  UserPlus,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TeamMentorCard } from "@/components/team/TeamMentorCard";
import { TeamStatsCards } from "@/components/team/TeamStatsCards";
import { AssignTaskDialog } from "@/components/team/AssignTaskDialog";
import { TeamTasksTab } from "@/components/team/TeamTasksTab";

interface TeamMember {
  user_id: string;
  mentor_id: string;
  mentor_name: string;
  full_name: string | null;
  email: string | null;
  active_status: boolean | null;
  last_login: string | null;
}

interface MemberStats {
  userId: string;
  totalTasks: number;
  completed: number;
  inProgress: number;
  todo: number;
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

const TeamDashboard = () => {
  const navigate = useNavigate();
  const { isTeamLeader, isAdmin, isLoading: roleLoading } = useUserRole();
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [memberStats, setMemberStats] = useState<Map<string, MemberStats>>(new Map());
  const [teamLeaderName, setTeamLeaderName] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("all");

  const fetchTeamData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // Get current user's profile to find team leader name
    const { data: profile } = await supabase
      .from("profiles")
      .select("mentor_name")
      .eq("user_id", session.user.id)
      .single();

    if (profile) {
      setTeamLeaderName(profile.mentor_name);

      // Fetch team members (those whose team_leader matches this user's mentor_name)
      const { data: members } = await supabase
        .from("profiles")
        .select("user_id, mentor_id, mentor_name, full_name, email, active_status, last_login")
        .eq("team_leader", profile.mentor_name)
        .neq("user_id", session.user.id);

      if (members) {
        setTeamMembers(members);

        // Fetch task stats for each member
        const statsMap = new Map<string, MemberStats>();
        const today = new Date();
        
        for (const member of members) {
          let query = supabase
            .from("tasks")
            .select("status, date_to")
            .eq("user_id", member.user_id);

          const { data: tasks } = await query;

          if (tasks) {
            // Filter by month if selected
            const filteredTasks = selectedMonth && selectedMonth !== "all"
              ? tasks.filter(t => {
                  const taskMonth = t.date_to?.substring(5, 7);
                  return taskMonth === selectedMonth;
                })
              : tasks;

            const completed = filteredTasks.filter((t) => t.status === "done").length;
            const inProgress = filteredTasks.filter((t) => t.status === "in_progress").length;
            const todo = filteredTasks.filter((t) => t.status === "todo").length;
            const overdue = filteredTasks.filter(t => {
              if (t.status === "done" || t.status === "archived" || !t.date_to) return false;
              return new Date(t.date_to) < today;
            }).length;
            const total = filteredTasks.length;

            statsMap.set(member.user_id, {
              userId: member.user_id,
              totalTasks: total,
              completed,
              inProgress,
              todo,
              overdue,
              completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
            });
          }
        }
        setMemberStats(statsMap);
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchTeamData();
  }, [navigate, selectedMonth]);

  useEffect(() => {
    if (!roleLoading && !isTeamLeader && !isAdmin) {
      navigate("/home");
    }
  }, [isTeamLeader, isAdmin, roleLoading, navigate]);

  const handleAssignTask = (member: TeamMember) => {
    setSelectedMember(member);
    setAssignDialogOpen(true);
  };

  const totalTeamTasks = Array.from(memberStats.values()).reduce((sum, s) => sum + s.totalTasks, 0);
  const totalCompleted = Array.from(memberStats.values()).reduce((sum, s) => sum + s.completed, 0);
  const totalInProgress = Array.from(memberStats.values()).reduce((sum, s) => sum + s.inProgress, 0);
  const totalOverdue = Array.from(memberStats.values()).reduce((sum, s) => sum + s.overdue, 0);
  const avgCompletionRate =
    memberStats.size > 0
      ? Math.round(Array.from(memberStats.values()).reduce((sum, s) => sum + s.completionRate, 0) / memberStats.size)
      : 0;

  if (roleLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
                <Users className="w-5 h-5 text-secondary" />
                <span className="font-semibold text-foreground">Team Dashboard</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
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
              <RoleBadge role="team_leader" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Team Leader Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl shadow-lg p-6 mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Welcome, {teamLeaderName}</h1>
              <p className="text-muted-foreground">
                Managing {teamMembers.length} team member{teamMembers.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/action-plans")}>
                <ClipboardList className="w-4 h-4 mr-2" />
                Action Plans
              </Button>
              <Button onClick={() => setAssignDialogOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Assign New Task
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Tabs: Overview + Team Tasks */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="overview" className="gap-2">
              <Users className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              Team Tasks
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            {/* Team Stats Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-5 gap-4"
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Team Members</p>
                      <p className="text-2xl font-bold">{teamMembers.length}</p>
                    </div>
                    <Users className="w-6 h-6 text-primary/50" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Tasks</p>
                      <p className="text-2xl font-bold">{totalTeamTasks}</p>
                    </div>
                    <ClipboardList className="w-6 h-6 text-primary/50" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Completed</p>
                      <p className="text-2xl font-bold text-green-500">{totalCompleted}</p>
                    </div>
                    <CheckCircle2 className="w-6 h-6 text-green-500/50" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">In Progress</p>
                      <p className="text-2xl font-bold text-blue-500">{totalInProgress}</p>
                    </div>
                    <Clock className="w-6 h-6 text-blue-500/50" />
                  </div>
                </CardContent>
              </Card>
              <Card className={totalOverdue > 0 ? "border-destructive/50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Overdue</p>
                      <p className={`text-2xl font-bold ${totalOverdue > 0 ? "text-destructive" : ""}`}>
                        {totalOverdue}
                      </p>
                    </div>
                    <AlertTriangle className={`w-6 h-6 ${totalOverdue > 0 ? "text-destructive/50" : "text-muted-foreground/50"}`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Team Progress */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Team Progress
                  </CardTitle>
                  <CardDescription>Overall team task completion rate</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Average Completion Rate</span>
                      <span className="font-bold">{avgCompletionRate}%</span>
                    </div>
                    <Progress value={avgCompletionRate} className="h-3" />
                    <p className="text-xs text-muted-foreground">
                      {totalCompleted} of {totalTeamTasks} tasks completed across the team
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Team Members Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-lg font-semibold text-foreground mb-4">Team Members</h2>
              {teamMembers.length === 0 ? (
                <div className="bg-card rounded-xl p-8 text-center">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-foreground mb-2">No Team Members Yet</h3>
                  <p className="text-muted-foreground">
                    Team members will appear here once they are assigned to your team.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {teamMembers.map((member) => (
                    <TeamMentorCard
                      key={member.user_id}
                      member={member}
                      stats={memberStats.get(member.user_id)}
                      onAssignTask={() => handleAssignTask(member)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* Team Tasks Tab */}
          <TabsContent value="tasks">
            <TeamTasksTab
              teamMembers={teamMembers}
              onRefresh={fetchTeamData}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Assign Task Dialog */}
      <AssignTaskDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        teamMembers={teamMembers}
        selectedMember={selectedMember}
        onTaskAssigned={() => {
          fetchTeamData();
        }}
      />
    </div>
  );
};

export default TeamDashboard;
