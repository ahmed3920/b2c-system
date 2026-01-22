import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { RoleBadge } from "@/components/RoleBadge";
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
} from "lucide-react";
import { motion } from "framer-motion";
import { TeamMentorCard } from "@/components/team/TeamMentorCard";
import { TeamStatsCards } from "@/components/team/TeamStatsCards";
import { AssignTaskDialog } from "@/components/team/AssignTaskDialog";

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
  completionRate: number;
}

const TeamDashboard = () => {
  const navigate = useNavigate();
  const { isTeamLeader, isAdmin, isLoading: roleLoading } = useUserRole();
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [memberStats, setMemberStats] = useState<Map<string, MemberStats>>(new Map());
  const [teamLeaderName, setTeamLeaderName] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  useEffect(() => {
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
          for (const member of members) {
            const { data: tasks } = await supabase
              .from("tasks")
              .select("status")
              .eq("user_id", member.user_id);

            if (tasks) {
              const completed = tasks.filter((t) => t.status === "done").length;
              const inProgress = tasks.filter((t) => t.status === "in_progress").length;
              const todo = tasks.filter((t) => t.status === "todo").length;
              const total = tasks.length;

              statsMap.set(member.user_id, {
                userId: member.user_id,
                totalTasks: total,
                completed,
                inProgress,
                todo,
                completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
              });
            }
          }
          setMemberStats(statsMap);
        }
      }

      setIsLoading(false);
    };

    fetchTeamData();
  }, [navigate]);

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
            <RoleBadge role="team_leader" />
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
            <Button onClick={() => setAssignDialogOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Assign New Task
            </Button>
          </div>
        </motion.div>

        {/* Team Stats Overview */}
        <TeamStatsCards
          totalMembers={teamMembers.length}
          totalTasks={totalTeamTasks}
          completedTasks={totalCompleted}
          inProgressTasks={totalInProgress}
          avgCompletionRate={avgCompletionRate}
        />

        {/* Team Members Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
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
      </main>

      {/* Assign Task Dialog */}
      <AssignTaskDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        teamMembers={teamMembers}
        selectedMember={selectedMember}
        onTaskAssigned={() => {
          // Refresh stats
          window.location.reload();
        }}
      />
    </div>
  );
};

export default TeamDashboard;
