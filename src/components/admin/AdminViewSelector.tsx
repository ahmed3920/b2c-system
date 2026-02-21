import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Eye, User, Users, Globe, Search, ChevronDown, X } from "lucide-react";
import type { AdminViewMode, TeamLeaderSubView } from "@/hooks/useAdminView";

interface Profile {
  user_id: string;
  mentor_name: string;
  full_name: string | null;
  team_leader: string;
  email: string | null;
}

interface AdminViewSelectorProps {
  viewMode: AdminViewMode;
  onViewModeChange: (mode: AdminViewMode) => void;
  selectedUserId: string | null;
  onSelectedUserChange: (id: string | null) => void;
  teamLeaders: Profile[];
  mentors: Profile[];
  selectedProfile: Profile | null;
  tlSubView?: TeamLeaderSubView;
  onTlSubViewChange?: (sub: TeamLeaderSubView) => void;
}

const viewLabels: Record<AdminViewMode, { label: string; icon: React.ReactNode; color: string }> = {
  my: { label: "My View", icon: <Eye className="w-4 h-4" />, color: "bg-primary/10 text-primary border-primary/30" },
  team_leader: { label: "Team Leader View", icon: <Users className="w-4 h-4" />, color: "bg-amber-50 text-amber-700 border-amber-200" },
  mentor: { label: "Mentor View", icon: <User className="w-4 h-4" />, color: "bg-blue-50 text-blue-700 border-blue-200" },
  all: { label: "All System", icon: <Globe className="w-4 h-4" />, color: "bg-green-50 text-green-700 border-green-200" },
};

export const AdminViewSelector = ({
  viewMode,
  onViewModeChange,
  selectedUserId,
  onSelectedUserChange,
  teamLeaders,
  mentors,
  selectedProfile,
  tlSubView = "team",
  onTlSubViewChange,
}: AdminViewSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const currentView = viewLabels[viewMode];
  const needsUserSelection = viewMode === "team_leader" || viewMode === "mentor";
  const userList = viewMode === "team_leader" ? teamLeaders : mentors;

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return userList;
    const q = searchQuery.toLowerCase();
    return userList.filter(u =>
      u.mentor_name.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.user_id.toLowerCase().includes(q)
    );
  }, [userList, searchQuery]);

  const handleViewChange = (mode: AdminViewMode) => {
    onViewModeChange(mode);
    if (mode !== "team_leader" && mode !== "mentor") {
      setIsOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* View Mode Buttons */}
      <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
        {(Object.keys(viewLabels) as AdminViewMode[]).map((mode) => {
          const v = viewLabels[mode];
          const isActive = viewMode === mode;
          return (
            <button
              key={mode}
              onClick={() => handleViewChange(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                isActive
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              {v.icon}
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          );
        })}
      </div>

      {/* User Selection for TL/Mentor views */}
      {needsUserSelection && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 min-w-[200px] justify-between">
              {selectedProfile ? (
                <span className="truncate">{selectedProfile.full_name || selectedProfile.mentor_name}</span>
              ) : (
                <span className="text-muted-foreground">
                  Select {viewMode === "team_leader" ? "Team Leader" : "Mentor"}...
                </span>
              )}
              <ChevronDown className="w-4 h-4 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-2" align="start">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="max-h-[250px] overflow-y-auto space-y-0.5">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No results</p>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.user_id}
                    onClick={() => {
                      onSelectedUserChange(user.user_id);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedUserId === user.user_id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-secondary"
                    }`}
                  >
                    <p className="font-medium truncate">{user.full_name || user.mentor_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email} · {user.team_leader}
                    </p>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* TL Sub-View Toggle */}
      {viewMode === "team_leader" && selectedUserId && onTlSubViewChange && (
        <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
          <button
            onClick={() => onTlSubViewChange("own")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              tlSubView === "own"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            }`}
          >
            TL's Tasks
          </button>
          <button
            onClick={() => onTlSubViewChange("team")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              tlSubView === "team"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            }`}
          >
            Team's Tasks
          </button>
        </div>
      )}

      {/* Active View Badge */}
      {selectedProfile && needsUserSelection && (
        <Badge variant="outline" className={`gap-1 ${currentView.color}`}>
          {selectedProfile.full_name || selectedProfile.mentor_name}
          <button onClick={() => onSelectedUserChange(null)} className="ml-1 hover:opacity-70">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}
    </div>
  );
};
