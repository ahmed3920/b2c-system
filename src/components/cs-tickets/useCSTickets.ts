import { useCallback, useEffect, useRef, useState } from "react";
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

const dedupeByTicketId = (rows: any[]): any[] => {
  const seen = new Set<string>();
  const unique: any[] = [];

  for (const row of rows) {
    const id = typeof row?.id === "string" ? row.id : "";
    const fallbackKey = [row?.ticket_number, row?.tutor_external_id, row?.created_at].filter(Boolean).join("|");
    const key = id || fallbackKey || String(unique.length);

    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  return unique;
};

const normalize = (rows: any[]): CSTicket[] =>
  dedupeByTicketId(rows).map((r) => ({
    ...r,
    case_types: r.case_types && r.case_types.length > 0 ? r.case_types : [r.case_type],
    session_recordings: Array.isArray(r.session_recordings) ? r.session_recordings : [],
    additional_tutors: Array.isArray(r.additional_tutors) ? r.additional_tutors : [],
    parent_attachments: Array.isArray(r.parent_attachments) ? r.parent_attachments : [],
  })) as CSTicket[];

async function fetchTickets(scope: CSTicketScope): Promise<CSTicket[] | null> {
  if (scope === "mine") {
    const { data, error } = await supabase.rpc("get_my_team_cs_tickets");
    return !error && data ? normalize(data as any[]) : null;
  }
  if (scope === "assigned_to_me") {
    const { data, error } = await supabase.rpc("get_my_assigned_cs_tickets");
    return !error && data ? normalize(data as any[]) : null;
  }
  // Paginate to bypass the default 1000-row limit
  const PAGE = 1000;
  let from = 0;
  const all: any[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("cs_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data) {
      if (all.length === 0) return null;
      break;
    }
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return normalize(all);
}

const HIDDEN_REFRESH_MS = 2 * 60 * 1000;
const REALTIME_DEBOUNCE_MS = 1500;
const RECENT_FETCH_MS = 2000;

export function useCSTickets(scope: CSTicketScope = "all") {
  const [tickets, setTickets] = useState<CSTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const inFlightRef = useRef(false);
  const lastFetchRef = useRef(0);

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    // Only show the loading state before the first successful load
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const result = await fetchTickets(scope);
      if (result) {
        setTickets(result);
        hasLoadedRef.current = true;
      } else if (!hasLoadedRef.current) {
        setTickets([]);
      }
    } finally {
      lastFetchRef.current = Date.now();
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [scope]);

  const loadRef = useRef(load);
  loadRef.current = load;

  // Reset + initial load when scope changes
  useEffect(() => {
    hasLoadedRef.current = false;
    load();
  }, [load]);

  // Quiet background sync: realtime changes + returning after a long absence
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hiddenAt: number | null = null;

    const onChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (Date.now() - lastFetchRef.current < RECENT_FETCH_MS) return;
        loadRef.current();
      }, REALTIME_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`cs_tickets_${scope}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cs_tickets" }, onChange)
      .subscribe();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt >= HIDDEN_REFRESH_MS) {
        hiddenAt = null;
        loadRef.current();
      } else {
        hiddenAt = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [scope]);

  const refresh = useCallback(async () => {
    await loadRef.current();
  }, []);

  return { tickets, loading, refresh };
}
