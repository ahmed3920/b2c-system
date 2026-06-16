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

export interface AdditionalTutor {
  tutor_external_id: string;
  tutor_name: string;
  team_leader: string;
  assigned_mentor_id?: string | null;
  assigned_mentor_name?: string | null;
}

export interface ParentAttachment {
  kind: "file" | "link";
  url: string;
  label?: string;
  path?: string;
  size?: number;
  mime?: string;
  added_at?: string;
  added_by?: string;
  added_by_name?: string;
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
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_by: string | null;
  closed_by_name: string | null;
  // Mentor evaluation
  assigned_mentor_id: string | null;
  assigned_mentor_name: string | null;
  mentor_assigned_at: string | null;
  mentor_evaluation_notes: string | null;
  mentor_recommendation: string | null;
  mentor_validation: string | null;
  session_recordings: SessionRecording[];
  additional_tutors: AdditionalTutor[];
  parent_attachments: ParentAttachment[];
}

export type CSTicketScope = "all" | "mine" | "assigned_to_me";

const normalize = (rows: any[]): CSTicket[] =>
  rows.map((r) => ({
    ...r,
    case_types: r.case_types && r.case_types.length > 0 ? r.case_types : [r.case_type],
    session_recordings: Array.isArray(r.session_recordings) ? r.session_recordings : [],
    additional_tutors: Array.isArray(r.additional_tutors) ? r.additional_tutors : [],
    parent_attachments: Array.isArray(r.parent_attachments) ? r.parent_attachments : [],
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
      // Paginate to bypass Supabase's default 1000-row limit
      const PAGE = 1000;
      let from = 0;
      const all: any[] = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("cs_tickets")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error || !data) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setTickets(normalize(all));
    }
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tickets, loading, refresh };
}
