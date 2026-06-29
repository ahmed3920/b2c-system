import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

export type AdminViewMode = "my" | "team_leader" | "mentor" | "all";
export type TeamLeaderSubView = "own" | "team";

interface Profile {
  user_id: string;
  mentor_name: string;
  full_name: string | null;
  team_leader: string;
  email: string | null;
  active_status: boolean | null;
}

interface AdminViewState {
  viewMode: AdminViewMode;
  setViewMode: (mode: AdminViewMode) => void;
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  tasks: Task[];
  isLoadingTasks: boolean;
  profiles: Profile[];
  teamLeaders: Profile[];
  mentors: Profile[];
  selectedProfile: Profile | null;
  refetchTasks: () => void;
  taskOwnerNames: Record<string, string>;
  tlSubView: TeamLeaderSubView;
  setTlSubView: (sub: TeamLeaderSubView) => void;
}

export function useAdminView(): AdminViewState {
  const { isAdmin } = useUserRole();
  const [viewMode, setViewMode] = useState<AdminViewMode>("my");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [taskOwnerNames, setTaskOwnerNames] = useState<Record<string, string>>({});
  const [tlSubView, setTlSubView] = useState<TeamLeaderSubView>("team");

  // Fetch profiles once (for admin)
  useEffect(() => {
    if (!isAdmin) return;
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, mentor_name, full_name, team_leader, email, active_status")
        .order("mentor_name");
      setProfiles(data || []);
    };
    fetchProfiles();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setCurrentUserId(session.user.id);
    });
  }, [isAdmin]);

  // Fetch roles to identify team leaders
  const [roleMap, setRoleMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!isAdmin) return;
    const fetchRoles = async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      const map = new Map<string, string>();
      (data || []).forEach(r => {
        const existing = map.get(r.user_id);
        if (!existing || r.role === "admin" || (r.role === "team_leader" && existing === "mentor")) {
          map.set(r.user_id, r.role);
        }
      });
      setRoleMap(map);
    };
    fetchRoles();
  }, [isAdmin]);

  const teamLeaders = useMemo(() => {
    return profiles.filter(p => roleMap.get(p.user_id) === "team_leader");
  }, [profiles, roleMap]);

  const mentors = useMemo(() => {
    // Everyone who isn't a team leader / super team leader counts as a "mentor-like"
    // entry in the picker — mentors, community moderators, admins acting as mentors, etc.
    return profiles.filter(p => {
      const r = roleMap.get(p.user_id);
      return r !== "team_leader" && r !== "super_team_leader";
    });
  }, [profiles, roleMap]);

  const selectedProfile = useMemo(() => {
    if (!selectedUserId) return null;
    return profiles.find(p => p.user_id === selectedUserId) || null;
  }, [selectedUserId, profiles]);

  // Fetch tasks based on view mode
  const fetchTasks = async () => {
    setIsLoadingTasks(true);
    try {
      let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });

      if (viewMode === "my" && currentUserId) {
        query = query.eq("user_id", currentUserId);
      } else if (viewMode === "team_leader" && selectedUserId) {
        const leader = profiles.find(p => p.user_id === selectedUserId);
        if (leader) {
          if (tlSubView === "own") {
            // Only the TL's own tasks
            query = query.eq("user_id", selectedUserId);
          } else {
            // Team's tasks (mentors under this TL)
            const teamMentorIds = profiles
              .filter(p => p.team_leader === leader.mentor_name && p.user_id !== selectedUserId)
              .map(p => p.user_id);
            if (teamMentorIds.length > 0) {
              query = query.in("user_id", teamMentorIds);
            } else {
              setTasks([]);
              setIsLoadingTasks(false);
              return;
            }
          }
        }
      } else if (viewMode === "mentor" && selectedUserId) {
        query = query.eq("user_id", selectedUserId);
      }
      // "all" mode - no filter, get everything

      // Paginate to bypass PostgREST's 1000-row cap so older tasks aren't hidden.
      const all: Task[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = data || [];
        all.push(...batch);
        if (batch.length < pageSize) break;
      }
      const data = all;
      setTasks(all);

      // Build owner name map
      const userIds = [...new Set((data || []).map(t => t.user_id))];
      const nameMap: Record<string, string> = {};
      profiles.forEach(p => {
        if (userIds.includes(p.user_id)) {
          nameMap[p.user_id] = p.full_name || p.mentor_name;
        }
      });
      setTaskOwnerNames(nameMap);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || !currentUserId) return;
    if ((viewMode === "team_leader" || viewMode === "mentor") && !selectedUserId) return;
    fetchTasks();
  }, [viewMode, selectedUserId, currentUserId, isAdmin, profiles.length, tlSubView]);

  return {
    viewMode,
    setViewMode: (mode: AdminViewMode) => {
      setViewMode(mode);
      if (mode === "my" || mode === "all") setSelectedUserId(null);
      if (mode !== "team_leader") setTlSubView("team");
    },
    selectedUserId,
    setSelectedUserId,
    tasks,
    isLoadingTasks,
    profiles,
    teamLeaders,
    mentors,
    selectedProfile,
    refetchTasks: fetchTasks,
    taskOwnerNames,
    tlSubView,
    setTlSubView,
  };
}
