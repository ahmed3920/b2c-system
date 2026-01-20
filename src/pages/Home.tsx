import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList,
  LayoutGrid,
  TrendingUp,
  FileBarChart,
  LogOut,
  User,
  Users,
  Clock,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

interface Profile {
  mentor_id: string;
  mentor_name: string;
  team_leader: string;
}

const Home = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("mentor_id, mentor_name, team_leader")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        setProfile(data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load profile data.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    navigate("/auth");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const dashboardCards = [
    {
      title: "Task Management",
      description: "View and manage all your tasks in a table format",
      icon: ClipboardList,
      href: "/tasks",
      enabled: true,
      color: "bg-gradient-primary",
    },
    {
      title: "Kanban Board",
      description: "Visualize tasks with drag-and-drop Kanban board",
      icon: LayoutGrid,
      href: "/kanban",
      enabled: true,
      color: "bg-gradient-accent",
    },
    {
      title: "Progress Tracking",
      description: "Track your performance and achievements",
      icon: TrendingUp,
      href: "/progress",
      enabled: false,
      color: "bg-secondary",
    },
    {
      title: "Reports & Analytics",
      description: "Generate detailed reports and insights",
      icon: FileBarChart,
      href: "/reports",
      enabled: false,
      color: "bg-secondary",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
      <nav className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                <span className="text-lg font-bold text-primary-foreground">iS</span>
              </div>
              <span className="font-bold text-lg text-foreground">Mentor Task Tracker</span>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome back, {profile?.mentor_name || "Mentor"}! 👋
          </h1>
          <p className="text-muted-foreground">
            Here's your personal dashboard. Manage your tasks and track your progress.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-1"
          >
            <div className="bg-card rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-primary p-6 text-center">
                <div className="w-20 h-20 bg-primary-foreground/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <User className="w-10 h-10 text-primary-foreground" />
                </div>
                <h2 className="text-xl font-bold text-primary-foreground">
                  {profile?.mentor_name || "Loading..."}
                </h2>
                <p className="text-primary-foreground/80 text-sm">
                  {profile?.mentor_id || ""}
                </p>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Team Leader</p>
                    <p className="font-medium text-foreground">{profile?.team_leader || "N/A"}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                  <Clock className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Session Status</p>
                    <p className="font-medium text-success">Active</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Last Access</p>
                    <p className="font-medium text-foreground">
                      {new Date().toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Dashboard Cards */}
          <div className="lg:col-span-2">
            <div className="grid sm:grid-cols-2 gap-4">
              {dashboardCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                >
                  <button
                    onClick={() => card.enabled && navigate(card.href)}
                    disabled={!card.enabled}
                    className={`w-full text-left p-6 rounded-xl transition-all duration-300 ${
                      card.enabled
                        ? "bg-card shadow-lg hover:shadow-xl hover:-translate-y-1 cursor-pointer"
                        : "bg-card/50 cursor-not-allowed"
                    }`}
                  >
                    <div
                      className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center mb-4 ${
                        card.enabled ? "shadow-md" : "opacity-50"
                      }`}
                    >
                      <card.icon className={`w-6 h-6 ${card.enabled ? "text-white" : "text-muted-foreground"}`} />
                    </div>
                    <h3 className={`text-lg font-semibold mb-1 ${!card.enabled && "text-muted-foreground"}`}>
                      {card.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{card.description}</p>
                    {!card.enabled && (
                      <span className="inline-block mt-3 px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-full">
                        Coming Soon
                      </span>
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
