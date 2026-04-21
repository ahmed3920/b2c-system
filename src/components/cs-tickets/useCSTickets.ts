import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CSTicketCaseType, CSTicketStatus } from "./csTicketCategories";

export interface CSTicket {
  id: string;
  ticket_number: string;
  ticket_date: string;
  case_type: CSTicketCaseType;
  category: string;
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

export function useCSTickets() {
  const [tickets, setTickets] = useState<CSTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cs_tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setTickets(data as unknown as CSTicket[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tickets, loading, refresh };
}
