import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Logo } from "@/components/Logo";
import { ArrowLeft, Loader2, Trophy, Flame, Target, TrendingUp, Calendar, Award } from "lucide-react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, Tooltip } from "recharts";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const COLORS = ["#056eec", "#fe7f1b", "#5dcb8d", "#798d99"];

const achievements = [
  { id: "early_bird", name: "Early Bird", icon: "🌅", description: "10 tasks before 9 AM", threshold: 10 },
  { id: "night_owl", name: "Night Owl", icon: "🦉", description: "10 tasks after 6 PM", threshold: 10 },
  { id: "speed_demon", name: "Speed Demon", icon: "⚡", description: "5 tasks in one day", threshold: 5 },
  { id: "consistency_king", name: "Consistency King", icon: "🔥", description: "7-day streak", threshold: 7 },
  { id: "century_club", name: "Century Club", icon: "💯", description: "100 tasks completed", threshold: 100 },
  { id: "task_master", name: "Task Master", icon: "🏆", description: "1000 tasks completed", threshold: 1000 },
];

const Progress = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    completedThisWeek: 0,
    completedThisMonth: 0,
    completedAllTime: 0,
    completionRate: 0,
    currentStreak: 0,
    avgCompletionTime: 0,
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role, isAdmin, isTeamLeader } = useUserRole();

  useEffect(() => {
    // Admins must not view individual task data
    if (isAdmin) {
      navigate("/home");
      return;
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Each user only sees their own tasks (RLS enforced)
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      
      if (data) {
        setTasks(data);
        calculateMetrics(data);
      }
      
      setIsLoading(false);
    };

    fetchData();
  }, [navigate, isAdmin, isTeamLeader]);

  const calculateMetrics = (taskData: Task[]) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const completed = taskData.filter(t => t.status === "done");
    const completedThisWeek = completed.filter(t => new Date(t.updated_at) >= weekAgo).length;
    const completedThisMonth = completed.filter(t => new Date(t.updated_at) >= monthAgo).length;
    const completedAllTime = completed.length;
    const completionRate = taskData.length > 0 
      ? Math.round((completed.length / taskData.filter(t => t.status !== "archived").length) * 100) 
      : 0;

    // Calculate streak (simplified)
    let streak = 0;
    const sortedCompleted = completed.sort((a, b) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    
    if (sortedCompleted.length > 0) {
      const dates = new Set(sortedCompleted.map(t => 
        new Date(t.updated_at).toDateString()
      ));
      let currentDate = new Date();
      while (dates.has(currentDate.toDateString())) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      }
    }

    setMetrics({
      completedThisWeek,
      completedThisMonth,
      completedAllTime,
      completionRate,
      currentStreak: streak,
      avgCompletionTime: 2.5, // Placeholder
    });
  };

  const getTaskTypeDistribution = () => {
    const distribution: Record<string, number> = {};
    tasks.filter(t => t.status === "done").forEach(task => {
      distribution[task.task_type] = (distribution[task.task_type] || 0) + 1;
    });
    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  };

  const getStatusDistribution = () => {
    const statuses = ["todo", "in_progress", "done", "archived"];
    return statuses.map(status => ({
      name: status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()),
      value: tasks.filter(t => t.status === status).length,
    }));
  };

  const getWeeklyProgress = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekData = days.map(day => ({ name: day, completed: 0 }));
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    tasks
      .filter(t => t.status === "done" && new Date(t.updated_at) >= weekAgo)
      .forEach(task => {
        const dayIndex = new Date(task.updated_at).getDay();
        weekData[dayIndex].completed++;
      });
    
    return weekData;
  };

  const getEarnedAchievements = () => {
    return achievements.map(achievement => ({
      ...achievement,
      earned: achievement.id === "century_club" 
        ? metrics.completedAllTime >= achievement.threshold
        : achievement.id === "consistency_king"
        ? metrics.currentStreak >= achievement.threshold
        : false,
      progress: achievement.id === "century_club"
        ? Math.min(metrics.completedAllTime / achievement.threshold * 100, 100)
        : achievement.id === "consistency_king"
        ? Math.min(metrics.currentStreak / achievement.threshold * 100, 100)
        : 0,
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const typeData = getTaskTypeDistribution();
  const statusData = getStatusDistribution();
  const weeklyData = getWeeklyProgress();
  const earnedAchievements = getEarnedAchievements();

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Navigation */}
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
              <h1 className="font-bold text-lg text-foreground">Progress Tracking</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl p-4 shadow-lg"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Calendar className="w-4 h-4" />
              <span className="text-xs">This Week</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.completedThisWeek}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card rounded-xl p-4 shadow-lg"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Target className="w-4 h-4" />
              <span className="text-xs">This Month</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.completedThisMonth}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl p-4 shadow-lg"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Trophy className="w-4 h-4" />
              <span className="text-xs">All Time</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.completedAllTime}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-card rounded-xl p-4 shadow-lg"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Completion Rate</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{metrics.completionRate}%</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl p-4 shadow-lg"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Flame className="w-4 h-4" />
              <span className="text-xs">Current Streak</span>
            </div>
            <p className="text-2xl font-bold text-orange-500">{metrics.currentStreak} days</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-card rounded-xl p-4 shadow-lg"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Award className="w-4 h-4" />
              <span className="text-xs">Achievements</span>
            </div>
            <p className="text-2xl font-bold text-primary">
              {earnedAchievements.filter(a => a.earned).length}/{achievements.length}
            </p>
          </motion.div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Task Type Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-xl p-6 shadow-lg"
          >
            <h3 className="font-semibold text-foreground mb-4">Task Type Distribution</h3>
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {typeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No completed tasks yet
              </div>
            )}
          </motion.div>

          {/* Status Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-card rounded-xl p-6 shadow-lg"
          >
            <h3 className="font-semibold text-foreground mb-4">Status Breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Bar dataKey="value" fill="#056eec" radius={[4, 4, 0, 0]} />
                <Tooltip />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Weekly Progress */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card rounded-xl p-6 shadow-lg"
          >
            <h3 className="font-semibold text-foreground mb-4">Weekly Progress</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weeklyData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Line 
                  type="monotone" 
                  dataKey="completed" 
                  stroke="#5dcb8d" 
                  strokeWidth={2}
                  dot={{ fill: "#5dcb8d" }}
                />
                <Tooltip />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Achievements Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-card rounded-xl p-6 shadow-lg"
        >
          <h3 className="font-semibold text-foreground mb-4">Achievements</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {earnedAchievements.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + index * 0.05 }}
                className={`relative p-4 rounded-xl border-2 text-center transition-all ${
                  achievement.earned
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/50 opacity-60"
                }`}
              >
                <span className="text-3xl mb-2 block">{achievement.icon}</span>
                <p className="font-medium text-sm text-foreground">{achievement.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{achievement.description}</p>
                {!achievement.earned && (
                  <div className="mt-2">
                    <div className="h-1 bg-border rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${achievement.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round(achievement.progress)}%
                    </p>
                  </div>
                )}
                {achievement.earned && (
                  <span className="absolute -top-2 -right-2 text-lg">✅</span>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Progress;
