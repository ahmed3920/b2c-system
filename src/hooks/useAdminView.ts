import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

export type AdminViewMode = "my" | "team_leader" | "mentor" | "admin" | "all";
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
  admins: Profile[];
  roleMap: Map<string, Set<string>>;
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

  // Fetch all roles per user (a user can hold several)
  const [roleMap, setRoleMap] = useState<Map<string, Set<string>>>(new Map());
  useEffect(() => {
    if (!isAdmin) return;
    const fetchRoles = async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      const map = new Map<string, Set<string>>();
      (data || []).forEach(r => {
        if (!map.has(r.user_id)) map.set(r.user_id, new Set());
        map.get(r.user_id)!.add(r.role as string);
      });
      setRoleMap(map);
    };
    fetchRoles();
  }, [isAdmin]);

  const has = (uid: string, ...roles: string[]) => {
    const s = roleMap.get(uid);
    return !!s && roles.some(r => s.has(r));
  };

  const teamLeaders = useMemo(() => {
    return profiles.filter(p => has(p.user_id, "team_leader", "super_team_leader"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, roleMap]);

  const mentors = useMemo(() => {
    return profiles.filter(p =>
      has(p.user_id, "mentor", "community_moderator") &&
      !has(p.user_id, "team_leader", "super_team_leader", "admin"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, roleMap]);

  const admins = useMemo(() => {
    return profiles.filter(p => has(p.user_id, "admin") && p.user_id !== currentUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, roleMap, currentUserId]);

  const selectedProfile = useMemo(() => {
    if (!selectedUserId) return null;
    return profiles.find(p => p.user_id === selectedUserId) || null;
  }, [selectedUserId, profiles]);

  // Fetch tasks based on view mode
  const fetchTasks = async () => {
    setIsLoadingTasks(true);
    try {
      // Build a fresh query each page so the PostgREST builder isn't reused after await.
      const buildQuery = () => {
        let q = supabase.from("tasks").select("*").order("created_at", { ascending: false });

        if (viewMode === "my" && currentUserId) {
          q = q.eq("user_id", currentUserId);
        } else if (viewMode === "team_leader") {
          if (selectedUserId) {
            const leader = profiles.find(p => p.user_id === selectedUserId);
            if (leader) {
              if (tlSubView === "own") {
                q = q.eq("user_id", selectedUserId);
              } else {
                const teamMentorIds = profiles
                  .filter(p => p.team_leader === leader.mentor_name && p.user_id !== selectedUserId)
                  .map(p => p.user_id);
                if (teamMentorIds.length > 0) {
                  q = q.in("user_id", teamMentorIds);
                } else {
                  return null;
                }
              }
            }
          } else {
            // Aggregated: all team leaders' own tasks
            const tlIds = teamLeaders.map(p => p.user_id);
            if (tlIds.length > 0) {
              q = q.in("user_id", tlIds);
            } else {
              return null;
            }
          }
        } else if (viewMode === "admin") {
          if (selectedUserId) {
            q = q.eq("user_id", selectedUserId);
          } else {
            const ids = admins.map(p => p.user_id);
            if (ids.length > 0) q = q.in("user_id", ids);
            else return null;
          }
        } else if (viewMode === "mentor") {
          if (selectedUserId) {
            q = q.eq("user_id", selectedUserId);
          } else {
            // Aggregated: all mentors' tasks
            const mentorIds = mentors.map(p => p.user_id);
            if (mentorIds.length > 0) {
              q = q.in("user_id", mentorIds);
            } else {
              return null;
            }
          }
        }
        return q;
      };

      // Quick check: if the team view has no members, bail out cleanly.
      if (viewMode === "team_leader" && selectedUserId) {
        const leader = profiles.find(p => p.user_id === selectedUserId);
        if (leader && tlSubView !== "own") {
          const hasTeam = profiles.some(
            p => p.team_leader === leader.mentor_name && p.user_id !== selectedUserId,
          );
          if (!hasTeam) {
            setTasks([]);
            setIsLoadingTasks(false);
            return;
          }
        }
      }
      // Aggregated tabs with an empty roster bail out cleanly too.
      if ((viewMode === "team_leader" && !selectedUserId && teamLeaders.length === 0) ||
          (viewMode === "mentor" && !selectedUserId && mentors.length === 0) ||
          (viewMode === "admin" && !selectedUserId && admins.length === 0)) {
        setTasks([]);
        setIsLoadingTasks(false);
        return;
      }

      // Paginate to bypass PostgREST's 1000-row cap so older tasks aren't hidden.
      const all: Task[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const q = buildQuery();
        if (!q) break;
        const { data: batch, error } = await q.range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = batch || [];
        all.push(...rows);
        if (rows.length < pageSize) break;
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
    fetchTasks();
  }, [viewMode, selectedUserId, currentUserId, isAdmin, profiles.length, roleMap.size, tlSubView]);

  return {
    viewMode,
    setViewMode: (mode: AdminViewMode) => {
      setViewMode(mode);
      setSelectedUserId(null);
      if (mode !== "team_leader") setTlSubView("team");
    },
    selectedUserId,
    setSelectedUserId,
    tasks,
    isLoadingTasks,
    profiles,
    teamLeaders,
    mentors,
    admins,
    roleMap,
    selectedProfile,
    refetchTasks: fetchTasks,
    taskOwnerNames,
    tlSubView,
    setTlSubView,
  };
}
