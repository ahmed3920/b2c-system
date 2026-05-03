import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SessionIncident {
  id: string;
  student_id: string | null;
  student_name: string | null;
  student_grade: string | null;
  tutor_external_id: string;
  tutor_name: string;
  team_leader: string;
  assigned_mentor_name: string | null;
  session_date: string | null;
  session_number: string | null;
  case_category: string;
  case_description: string | null;
  supporting_link: string | null;
  source: "staff" | "tutor_self";
  submitted_by: string | null;
  submitted_by_name: string | null;
  validation_status: "pending" | "approved" | "rejected";
  validated_by: string | null;
  validated_by_name: string | null;
  validated_at: string | null;
  rejection_reason: string | null;
  sent_to_cs: boolean;
  cs_ticket_number: string | null;
  cs_response: string | null;
  cs_status: "open" | "closed" | null;
  token_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useSessionIncidents() {
  const [items, setItems] = useState<SessionIncident[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("session_incidents")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as SessionIncident[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { items, loading, refresh };
}
