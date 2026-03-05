import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Eye, User, Search, ChevronDown, X } from "lucide-react";
import type { TLViewMode } from "@/hooks/useTeamLeaderView";

interface Profile {
  user_id: string;
  mentor_name: string;
  full_name: string | null;
  team_leader: string;
  email: string | null;
}

interface TeamLeaderViewSelectorProps {
  viewMode: TLViewMode;
  onViewModeChange: (mode: TLViewMode) => void;
  selectedUserId: string | null;
  onSelectedUserChange: (id: string | null) => void;
  mentors: Profile[];
  selectedProfile: Profile | null;
}

const viewLabels: Record<TLViewMode, { label: string; icon: React.ReactNode }> = {
  my: { label: "My Tasks", icon: <Eye className="w-4 h-4" /> },
  mentor: { label: "Mentor View", icon: <User className="w-4 h-4" /> },
};

export const TeamLeaderViewSelector = ({
  viewMode,
  onViewModeChange,
  selectedUserId,
  onSelectedUserChange,
  mentors,
  selectedProfile,
}: TeamLeaderViewSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredMentors = useMemo(() => {
    if (!searchQuery) return mentors;
    const q = searchQuery.toLowerCase();
    return mentors.filter(u =>
      u.mentor_name.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  }, [mentors, searchQuery]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
        {(Object.keys(viewLabels) as TLViewMode[]).map((mode) => {
          const v = viewLabels[mode];
          const isActive = viewMode === mode;
          return (
            <button
              key={mode}
              onClick={() => {
                onViewModeChange(mode);
                if (mode === "my") setIsOpen(false);
              }}
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

      {viewMode === "mentor" && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 min-w-[200px] justify-between">
              {selectedProfile ? (
                <span className="truncate">{selectedProfile.full_name || selectedProfile.mentor_name}</span>
              ) : (
                <span className="text-muted-foreground">Select Mentor...</span>
              )}
              <ChevronDown className="w-4 h-4 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-2" align="start">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="max-h-[250px] overflow-y-auto space-y-0.5">
              {filteredMentors.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No mentors found</p>
              ) : (
                filteredMentors.map((user) => (
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
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {selectedProfile && viewMode === "mentor" && (
        <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
          {selectedProfile.full_name || selectedProfile.mentor_name}
          <button onClick={() => onSelectedUserChange(null)} className="ml-1 hover:opacity-70">
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}
    </div>
  );
};
