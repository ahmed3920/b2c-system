import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { RoleBadge } from "@/components/RoleBadge";
import { Logo } from "@/components/Logo";
import {
  LogOut,
  Loader2,
  ClipboardList,
  Kanban,
  TrendingUp,
  FileText,
  Users,
  Settings,
  Shield,
  LayoutDashboard,
  BarChart3,
  Target,
  Star,
} from "lucide-react";
import { motion } from "framer-motion";

interface Profile {
  mentor_id: string;
  mentor_name: string;
  team_leader: string;
  full_name?: string;
  last_login?: string;
}

interface DashboardCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  disabled?: boolean;
  roles: AppRole[];
  disabledForRoles?: AppRole[];
}

const allCards: DashboardCard[] = [
  {
    title: "System Dashboard",
    description: "Overall system metrics and health",
    icon: <LayoutDashboard className="w-8 h-8" />,
    href: "/admin/dashboard",
    disabled: false,
    roles: ["admin"],
  },
  {
    title: "User Management",
    description: "Manage all system users",
    icon: <Users className="w-8 h-8" />,
    href: "/admin/users",
    disabled: false,
    roles: ["admin"],
  },
  {
    title: "Team Overview",
    description: "View your team metrics",
    icon: <LayoutDashboard className="w-8 h-8" />,
    href: "/team/dashboard",
    disabled: false,
    roles: ["team_leader"],
  },
  {
    title: "My Mentors",
    description: "Manage team members",
    icon: <Users className="w-8 h-8" />,
    href: "/team/dashboard",
    disabled: false,
    roles: ["team_leader"],
  },
  {
    title: "Task Management",
    description: "Manage your assigned tasks",
    icon: <ClipboardList className="w-8 h-8" />,
    href: "/tasks",
    roles: ["admin", "team_leader", "mentor", "community_moderator"],
  },
  {
    title: "Kanban Board",
    description: "Visual task management",
    icon: <Kanban className="w-8 h-8" />,
    href: "/kanban",
    roles: ["admin", "team_leader", "mentor", "community_moderator"],
  },
  {
    title: "Progress Tracking",
    description: "Track performance and achievements",
    icon: <TrendingUp className="w-8 h-8" />,
    href: "/progress",
    roles: ["admin", "team_leader", "mentor", "community_moderator"],
  },
  {
    title: "Reports & Analytics",
    description: "Generate detailed reports",
    icon: <FileText className="w-8 h-8" />,
    href: "/reports",
    roles: ["admin", "team_leader", "mentor", "community_moderator"],
  },
  {
    title: "Tracking Numbers",
    description: "Upload sheets and view performance metrics",
    icon: <BarChart3 className="w-8 h-8" />,
    href: "/tracking-numbers",
    roles: ["admin"],
    disabledForRoles: ["team_leader"],
  },
  {
    title: "Action Plans",
    description: "Manage tutor action plans and track improvement",
    icon: <Target className="w-8 h-8" />,
    href: "/action-plans",
    roles: ["admin", "team_leader"],
  },
  {
    title: "Student Engagement",
    description: "Monthly tutor ratings & sessions by team leader",
    icon: <Star className="w-8 h-8" />,
    href: "/engagement",
    roles: ["admin"],
  },
];

const Home = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [taskStats, setTaskStats] = useState({ total: 0, inProgress: 0, completed: 0 });
  const [groupedStats, setGroupedStats] = useState<
    Array<{ name: string; total: number; inProgress: number; completed: number }>
  >([]);
  const [groupBy, setGroupBy] = useState<"team_leader" | "mentor">("team_leader");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, isLoading: roleLoading, isAdmin, isTeamLeader } = useUserRole();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Determine which user_ids this viewer can see tasks for
      let visibleProfiles: Array<{ user_id: string; mentor_name: string; team_leader: string }> = [];

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, mentor_name, team_leader");

      visibleProfiles = profilesData || [];

      const visibleIds = visibleProfiles.map((p) => p.user_id);

      let tasksQuery = supabase.from("tasks").select("status, user_id");
      if (visibleIds.length > 0) {
        tasksQuery = tasksQuery.in("user_id", visibleIds);
      } else {
        tasksQuery = tasksQuery.eq("user_id", session.user.id);
      }
      const { data: tasks } = await tasksQuery;

      if (tasks) {
        setTaskStats({
          total: tasks.length,
          inProgress: tasks.filter((t) => t.status === "in_progress").length,
          completed: tasks.filter((t) => t.status === "done").length,
        });

        // Build grouping map: user_id -> profile
        const profileMap = new Map(
          visibleProfiles.map((p) => [p.user_id, p])
        );

        // Identify which user_ids belong to team leaders (a TL's own user_id is one whose
        // mentor_name appears as someone else's team_leader, OR who has no team_leader set).
        const teamLeaderNames = new Set(
          visibleProfiles.map((p) => p.team_leader).filter(Boolean)
        );
        const isTeamLeaderUser = (userId: string) => {
          const p = profileMap.get(userId);
          if (!p) return false;
          return teamLeaderNames.has(p.mentor_name);
        };

        const buildGroups = (mode: "team_leader" | "mentor") => {
          const map = new Map<string, { total: number; inProgress: number; completed: number }>();
          tasks.forEach((t) => {
            const p = profileMap.get(t.user_id);
            if (!p) return;
            // Per-person grouping: only count tasks owned by people of that role
            if (mode === "team_leader" && !isTeamLeaderUser(t.user_id)) return;
            if (mode === "mentor" && isTeamLeaderUser(t.user_id)) return;
            const groupName = p.mentor_name;
            if (!groupName) return;
            const cur = map.get(groupName) || { total: 0, inProgress: 0, completed: 0 };
            cur.total += 1;
            if (t.status === "in_progress") cur.inProgress += 1;
            if (t.status === "done") cur.completed += 1;
            map.set(groupName, cur);
          });
          return Array.from(map.entries())
            .map(([name, v]) => ({ name, ...v }))
            .sort((a, b) => b.total - a.total);
        };

        // Default grouping; will be re-computed on toggle via separate effect by storing both
        (window as any).__taskGroupings = {
          team_leader: buildGroups("team_leader"),
          mentor: buildGroups("mentor"),
        };
        setGroupedStats((window as any).__taskGroupings.team_leader);
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const groupings = (window as any).__taskGroupings;
    if (groupings) {
      setGroupedStats(groupings[groupBy] || []);
    }
  }, [groupBy]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    navigate("/auth");
  };

  const filteredCards = allCards.filter(card => 
    role && card.roles.includes(role)
  );

  if (isLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayName = profile?.full_name || profile?.mentor_name || "User";
  const displayId = profile?.mentor_id || "N/A";
  const lastAccess = profile?.last_login 
    ? new Date(profile.last_login).toLocaleString()
    : new Date().toLocaleString();

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Logo variant="blue" className="h-10" />
              <div className="h-6 w-px bg-border" />
              <span className="font-semibold text-foreground">Dashboard</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl shadow-lg p-6 mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center text-2xl font-bold text-primary-foreground">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-foreground">{displayName}</h2>
                  <RoleBadge role={role} size="sm" />
                </div>
                <p className="text-muted-foreground">ID: {displayId}</p>
                {profile?.team_leader && !isAdmin && (
                  <p className="text-sm text-muted-foreground">
                    Team Leader: {profile.team_leader}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col text-right">
              <span className="inline-flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Status: Active
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Last Access: {lastAccess}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats (for Team Leaders and Admins) */}
        {(isAdmin || isTeamLeader) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 space-y-4"
          >
            {(() => {
              const agg = groupedStats.reduce(
                (acc, g) => {
                  acc.total += g.total;
                  acc.inProgress += g.inProgress;
                  acc.completed += g.completed;
                  return acc;
                },
                { total: 0, inProgress: 0, completed: 0 }
              );
              return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-card rounded-lg p-4 shadow">
                    <p className="text-sm text-muted-foreground">
                      Total Tasks ({groupBy === "team_leader" ? "Team Leaders" : "Mentors"})
                    </p>
                    <p className="text-2xl font-bold text-foreground">{agg.total}</p>
                  </div>
                  <div className="bg-card rounded-lg p-4 shadow">
                    <p className="text-sm text-muted-foreground">In Progress</p>
                    <p className="text-2xl font-bold text-blue-600">{agg.inProgress}</p>
                  </div>
                  <div className="bg-card rounded-lg p-4 shadow">
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{agg.completed}</p>
                  </div>
                  <div className="bg-card rounded-lg p-4 shadow">
                    <p className="text-sm text-muted-foreground">Completion Rate</p>
                    <p className="text-2xl font-bold text-primary">
                      {agg.total > 0 ? Math.round((agg.completed / agg.total) * 100) : 0}%
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Breakdown by group */}
            <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border flex-wrap gap-2">
                <h3 className="font-semibold text-foreground">
                  Breakdown by {groupBy === "team_leader" ? "Team Leader" : "Mentor"}
                </h3>
                <div className="inline-flex rounded-md border border-border overflow-hidden">
                  <button
                    onClick={() => setGroupBy("team_leader")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      groupBy === "team_leader"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Team Leader
                  </button>
                  <button
                    onClick={() => setGroupBy("mentor")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      groupBy === "mentor"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Mentor
                  </button>
                </div>
              </div>
              {groupedStats.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  No data available.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                          {groupBy === "team_leader" ? "Team Leader" : "Mentor"}
                        </th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">In Progress</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Completed</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedStats.map((g) => (
                        <tr key={g.name} className="border-t border-border hover:bg-muted/30">
                          <td className="px-4 py-2 text-foreground font-medium">{g.name}</td>
                          <td className="px-4 py-2 text-right text-foreground">{g.total}</td>
                          <td className="px-4 py-2 text-right text-blue-600">{g.inProgress}</td>
                          <td className="px-4 py-2 text-right text-green-600">{g.completed}</td>
                          <td className="px-4 py-2 text-right text-primary font-medium">
                            {g.total > 0 ? Math.round((g.completed / g.total) * 100) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredCards.map((card, index) => {
            const isDisabled = card.disabled || (role && card.disabledForRoles?.includes(role));
            return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <button
                onClick={() => !isDisabled && navigate(card.href)}
                disabled={isDisabled}
                className={`w-full text-left bg-card rounded-xl p-6 shadow-lg border border-border transition-all duration-300 
                  ${isDisabled 
                    ? "opacity-50 cursor-not-allowed" 
                    : "hover:shadow-xl hover:-translate-y-1 hover:border-primary/50"
                  }`}
              >
                <div className="text-primary mb-4">{card.icon}</div>
                <h3 className="font-semibold text-foreground mb-1">{card.title}</h3>
                <p className="text-sm text-muted-foreground">{card.description}</p>
                {isDisabled && (
                  <span className="inline-block mt-2 text-xs bg-secondary px-2 py-0.5 rounded">
                    Coming Soon
                  </span>
                )}
              </button>
            </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default Home;
