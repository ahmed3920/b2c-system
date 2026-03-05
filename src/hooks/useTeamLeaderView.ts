import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

export type TLViewMode = "my" | "mentor";

interface Profile {
  user_id: string;
  mentor_name: string;
  full_name: string | null;
  team_leader: string;
  email: string | null;
  active_status: boolean | null;
}

interface TeamLeaderViewState {
  viewMode: TLViewMode;
  setViewMode: (mode: TLViewMode) => void;
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  tasks: Task[];
  isLoadingTasks: boolean;
  teamMentors: Profile[];
  selectedProfile: Profile | null;
  refetchTasks: () => void;
  taskOwnerNames: Record<string, string>;
}

export function useTeamLeaderView(): TeamLeaderViewState {
  const { isTeamLeader, isAdmin } = useUserRole();
  const [viewMode, setViewMode] = useState<TLViewMode>("my");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [teamMentors, setTeamMentors] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [taskOwnerNames, setTaskOwnerNames] = useState<Record<string, string>>({});

  const enabled = isTeamLeader && !isAdmin;

  // Fetch team mentors
  useEffect(() => {
    if (!enabled) return;
    const fetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setCurrentUserId(session.user.id);

      // Get current user's profile to find their mentor_name (used as team_leader reference)
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("mentor_name")
        .eq("user_id", session.user.id)
        .single();

      if (!myProfile) return;

      // Get all profiles in my team (excluding myself)
      const { data: mentors } = await supabase
        .from("profiles")
        .select("user_id, mentor_name, full_name, team_leader, email, active_status")
        .eq("team_leader", myProfile.mentor_name)
        .neq("user_id", session.user.id)
        .order("mentor_name");

      setTeamMentors(mentors || []);
    };
    fetch();
  }, [enabled]);

  const selectedProfile = useMemo(() => {
    if (!selectedUserId) return null;
    return teamMentors.find(p => p.user_id === selectedUserId) || null;
  }, [selectedUserId, teamMentors]);

  const fetchTasks = async () => {
    if (!enabled || !currentUserId) return;

    setIsLoadingTasks(true);
    try {
      let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });

      if (viewMode === "mentor" && selectedUserId) {
        query = query.eq("user_id", selectedUserId);
      } else if (viewMode === "mentor" && !selectedUserId) {
        // Show all team mentors' tasks (not TL's own)
        const mentorIds = teamMentors.map(m => m.user_id);
        if (mentorIds.length === 0) {
          setTasks([]);
          setIsLoadingTasks(false);
          return;
        }
        query = query.in("user_id", mentorIds);
      } else {
        query = query.eq("user_id", currentUserId);
      }

      const { data, error } = await query.limit(1000);
      if (error) throw error;
      setTasks(data || []);

      // Build owner name map (include current user)
      const nameMap: Record<string, string> = {};
      if (currentUserId) {
        const { data: myProfile } = await supabase
          .from("profiles")
          .select("full_name, mentor_name")
          .eq("user_id", currentUserId)
          .single();
        if (myProfile) {
          nameMap[currentUserId] = myProfile.full_name || myProfile.mentor_name;
        }
      }
      teamMentors.forEach(p => {
        nameMap[p.user_id] = p.full_name || p.mentor_name;
      });
      setTaskOwnerNames(nameMap);
    } catch (err) {
      console.error("Error fetching TL view tasks:", err);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (!enabled || !currentUserId) return;
    fetchTasks();
    fetchTasks();
  }, [viewMode, selectedUserId, currentUserId, enabled, teamMentors.length]);

  return {
    viewMode,
    setViewMode: (mode: TLViewMode) => {
      setViewMode(mode);
      if (mode === "my") setSelectedUserId(null);
    },
    selectedUserId,
    setSelectedUserId,
    tasks,
    isLoadingTasks,
    teamMentors,
    selectedProfile,
    refetchTasks: fetchTasks,
    taskOwnerNames,
  };
}
