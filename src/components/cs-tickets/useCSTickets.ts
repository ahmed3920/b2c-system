import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CSTicketCaseType, CSTicketStatus } from "./csTicketCategories";

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
}

export type CSTicketScope = "all" | "mine";

const normalize = (rows: any[]): CSTicket[] =>
  rows.map((r) => ({
    ...r,
    case_types: r.case_types && r.case_types.length > 0 ? r.case_types : [r.case_type],
  })) as CSTicket[];

/**
 * Fetches CS tickets. Scope is enforced server-side:
 * - "all": every row the caller is allowed to see (RLS).
 * - "mine": only tickets whose team_leader matches the signed-in user,
 *   filtered by the SQL function `get_my_team_cs_tickets`. No name
 *   matching is done in the browser.
 */
export function useCSTickets(scope: CSTicketScope = "all") {
  const [tickets, setTickets] = useState<CSTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    if (scope === "mine") {
      const { data, error } = await supabase.rpc("get_my_team_cs_tickets");
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
