import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CSTicketCaseType, CSTicketStatus } from "./csTicketCategories";

export interface SessionRecording {
  kind: "file" | "link";
  url: string;
  label?: string;
  path?: string; // storage path when kind === "file"
  added_at?: string;
  added_by?: string;
}

export interface CSTicket {
  id: string;
  ticket_number: string;
  ticket_date: string;
  case_type: CSTicketCaseType;
  case_types: CSTicketCaseType[];
  category: string;
  cs_category: string | null;
  edu_category: string | null;
  tutor_external_id: string;
  tutor_name: string;
  team_leader: string;
  case_details: string | null;
  student_id: string | null;
  session_num_or_date: string | null;
  need_response_deadline: string | null;
  status: CSTicketStatus;
  team_leader_response: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Mentor evaluation
  assigned_mentor_id: string | null;
  assigned_mentor_name: string | null;
  mentor_assigned_at: string | null;
  mentor_evaluation_notes: string | null;
  mentor_recommendation: string | null;
  session_recordings: SessionRecording[];
}

export type CSTicketScope = "all" | "mine" | "assigned_to_me";

const normalize = (rows: any[]): CSTicket[] =>
  rows.map((r) => ({
    ...r,
    case_types: r.case_types && r.case_types.length > 0 ? r.case_types : [r.case_type],
    session_recordings: Array.isArray(r.session_recordings) ? r.session_recordings : [],
  })) as CSTicket[];

export function useCSTickets(scope: CSTicketScope = "all") {
  const [tickets, setTickets] = useState<CSTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    if (scope === "mine") {
      const { data, error } = await supabase.rpc("get_my_team_cs_tickets");
      setTickets(!error && data ? normalize(data as any[]) : []);
    } else if (scope === "assigned_to_me") {
      const { data, error } = await supabase.rpc("get_my_assigned_cs_tickets");
      setTickets(!error && data ? normalize(data as any[]) : []);
    } else {
      const { data, error } = await supabase
        .from("cs_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      setTickets(!error && data ? normalize(data as any[]) : []);
    }
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tickets, loading, refresh };
}
