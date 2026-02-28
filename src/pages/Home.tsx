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
];

const Home = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [taskStats, setTaskStats] = useState({ total: 0, inProgress: 0, completed: 0 });
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

      // Fetch task stats
      const { data: tasks } = await supabase
        .from("tasks")
        .select("status")
        .eq("user_id", session.user.id);
      
      if (tasks) {
        setTaskStats({
          total: tasks.length,
          inProgress: tasks.filter(t => t.status === "in_progress").length,
          completed: tasks.filter(t => t.status === "done").length,
        });
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [navigate]);

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
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <div className="bg-card rounded-lg p-4 shadow">
              <p className="text-sm text-muted-foreground">Total Tasks</p>
              <p className="text-2xl font-bold text-foreground">{taskStats.total}</p>
            </div>
            <div className="bg-card rounded-lg p-4 shadow">
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">{taskStats.inProgress}</p>
            </div>
            <div className="bg-card rounded-lg p-4 shadow">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600">{taskStats.completed}</p>
            </div>
            <div className="bg-card rounded-lg p-4 shadow">
              <p className="text-sm text-muted-foreground">Completion Rate</p>
              <p className="text-2xl font-bold text-primary">
                {taskStats.total > 0 
                  ? Math.round((taskStats.completed / taskStats.total) * 100) 
                  : 0}%
              </p>
            </div>
          </motion.div>
        )}

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <button
                onClick={() => !card.disabled && navigate(card.href)}
                disabled={card.disabled}
                className={`w-full text-left bg-card rounded-xl p-6 shadow-lg border border-border transition-all duration-300 
                  ${card.disabled 
                    ? "opacity-50 cursor-not-allowed" 
                    : "hover:shadow-xl hover:-translate-y-1 hover:border-primary/50"
                  }`}
              >
                <div className="text-primary mb-4">{card.icon}</div>
                <h3 className="font-semibold text-foreground mb-1">{card.title}</h3>
                <p className="text-sm text-muted-foreground">{card.description}</p>
                {card.disabled && (
                  <span className="inline-block mt-2 text-xs bg-secondary px-2 py-0.5 rounded">
                    Coming Soon
                  </span>
                )}
              </button>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Home;
