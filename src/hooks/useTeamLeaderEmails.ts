import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TeamLeaderEmail {
  id: string;
  team_leader_name: string;
  email: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useTeamLeaderEmails() {
  const [items, setItems] = useState<TeamLeaderEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("team_leader_emails")
      .select("*")
      .order("team_leader_name");
    if (data) setItems(data as TeamLeaderEmail[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { items, isLoading, refetch: fetch };
}

export function useTeamLeaderEmailFor(teamLeaderName: string | null | undefined) {
  const [record, setRecord] = useState<TeamLeaderEmail | null>(null);

  useEffect(() => {
    if (!teamLeaderName) {
      setRecord(null);
      return;
    }
    supabase
      .from("team_leader_emails")
      .select("*")
      .ilike("team_leader_name", teamLeaderName)
      .maybeSingle()
      .then(({ data }) => setRecord((data as TeamLeaderEmail | null) ?? null));
  }, [teamLeaderName]);

  return record;
}
