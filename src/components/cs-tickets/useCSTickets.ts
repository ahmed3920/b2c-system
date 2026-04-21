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

/**
 * Fetches CS tickets. Scope is enforced by the database:
 * - "all": returns every row the caller is allowed to see (RLS).
 * - "mine": additionally restricts to tickets whose team_leader matches
 *   the signed-in user via the SQL function `cs_ticket_belongs_to_me`.
 *   No name matching is done in the browser.
 */
export function useCSTickets(scope: CSTicketScope = "all") {
  const [tickets, setTickets] = useState<CSTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("cs_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (scope === "mine") {
      // Server-side filter via SQL function — no client-side matching.
      query = query.filter("team_leader", "cs.{}", "" as any); // placeholder, replaced below
    }

    // For the "mine" scope use an RPC-style filter. Postgrest doesn't support
    // calling arbitrary functions in a filter, so we expose a view-less helper
    // by querying with a function predicate using `.or` on a computed column
    // is not possible either. Instead, we use a dedicated RPC.
    if (scope === "mine") {
      const { data, error } = await supabase.rpc("get_my_team_cs_tickets");
      if (!error && data) {
        const rows = (data as any[]).map((r) => ({
          ...r,
          case_types: r.case_types && r.case_types.length > 0 ? r.case_types : [r.case_type],
        })) as CSTicket[];
        setTickets(rows);
      } else {
        setTickets([]);
      }
      setLoading(false);
      return;
    }

    const { data, error } = await query;
    if (!error && data) {
      const rows = (data as any[]).map((r) => ({
        ...r,
        case_types: r.case_types && r.case_types.length > 0 ? r.case_types : [r.case_type],
      })) as CSTicket[];
      setTickets(rows);
    }
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tickets, loading, refresh };
}
