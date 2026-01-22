import { motion } from "framer-motion";
import { Users, ClipboardList, CheckCircle2, Clock, TrendingUp } from "lucide-react";

interface TeamStatsCardsProps {
  totalMembers: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  avgCompletionRate: number;
}

export function TeamStatsCards({
  totalMembers,
  totalTasks,
  completedTasks,
  inProgressTasks,
  avgCompletionRate,
}: TeamStatsCardsProps) {
  const stats = [
    {
      label: "Team Members",
      value: totalMembers,
      icon: Users,
      color: "text-secondary",
      bg: "bg-secondary/10",
    },
    {
      label: "Total Tasks",
      value: totalTasks,
      icon: ClipboardList,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Completed",
      value: completedTasks,
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-500/10",
    },
    {
      label: "In Progress",
      value: inProgressTasks,
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-500/10",
    },
    {
      label: "Avg Completion",
      value: `${avgCompletionRate}%`,
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="grid grid-cols-2 md:grid-cols-5 gap-4"
    >
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="bg-card rounded-lg p-4 shadow border border-border"
        >
          <div className={`inline-flex p-2 rounded-lg ${stat.bg} mb-2`}>
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
          </div>
          <p className="text-2xl font-bold text-foreground">{stat.value}</p>
          <p className="text-sm text-muted-foreground">{stat.label}</p>
        </div>
      ))}
    </motion.div>
  );
}
