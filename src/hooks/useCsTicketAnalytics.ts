import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CsAnalyticsTicket {
  id: string;
  ticket_number: string | null;
  ticket_date: string | null;
  created_at: string;
  closed_at: string | null;
  need_response_deadline: string | null;
  case_type: string | null;
  case_types: string[] | null;
  category: string | null;
  cs_category: string | null;
  edu_category: string | null;
  status: string | null;
  team_leader: string | null;
  tutor_name: string | null;
  tutor_external_id: string | null;
  assigned_mentor_name: string | null;
  mentor_validation: string | null;
}

const COLUMNS =
  "id,ticket_number,ticket_date,created_at,closed_at,need_response_deadline,case_type,case_types,category,cs_category,edu_category,status,team_leader,tutor_name,tutor_external_id,assigned_mentor_name,mentor_validation";

/** Loads every CS ticket (paged past the 1000-row API limit) for client-side analysis. */
export function useCsTicketAnalytics() {
  const [tickets, setTickets] = useState<CsAnalyticsTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const PAGE = 1000;
    let from = 0;
    const all: CsAnalyticsTicket[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error: err } = await supabase
        .from("cs_tickets")
        .select(COLUMNS)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE - 1);
      if (err) {
        setError(err.message);
        break;
      }
      if (!data) break;
      all.push(...(data as unknown as CsAnalyticsTicket[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    // Defensive de-duplication (paging can repeat rows if data shifts mid-read).
    const seen = new Set<string>();
    setTickets(all.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true))));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tickets, loading, error, refresh };
}
