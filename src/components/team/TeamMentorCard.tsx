import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ClipboardList, CheckCircle2, Clock, AlertCircle, UserCheck, UserX } from "lucide-react";

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

interface TeamMentorCardProps {
  member: TeamMember;
  stats?: MemberStats;
  onAssignTask: () => void;
}

export function TeamMentorCard({ member, stats, onAssignTask }: TeamMentorCardProps) {
  const displayName = member.full_name || member.mentor_name;
  const lastLogin = member.last_login
    ? new Date(member.last_login).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never";

  return (
    <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden hover:shadow-xl transition-shadow">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center text-lg font-bold text-primary-foreground">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{displayName}</h3>
              <p className="text-sm text-muted-foreground">{member.mentor_id}</p>
            </div>
          </div>
          {member.active_status ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
              <UserCheck className="w-3 h-3" /> Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              <UserX className="w-3 h-3" /> Inactive
            </span>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Completion Rate</span>
              <span className="font-semibold text-foreground">{stats.completionRate}%</span>
            </div>
            <Progress value={stats.completionRate} className="h-2" />

            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
                  <AlertCircle className="w-3 h-3" />
                  <span className="text-lg font-bold">{stats.todo}</span>
                </div>
                <p className="text-xs text-muted-foreground">To Do</p>
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                  <Clock className="w-3 h-3" />
                  <span className="text-lg font-bold">{stats.inProgress}</span>
                </div>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span className="text-lg font-bold">{stats.completed}</span>
                </div>
                <p className="text-xs text-muted-foreground">Done</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">Last login: {lastLogin}</p>
          <Button size="sm" variant="outline" onClick={onAssignTask}>
            <ClipboardList className="w-3 h-3 mr-1" />
            Assign Task
          </Button>
        </div>
      </div>
    </div>
  );
}
