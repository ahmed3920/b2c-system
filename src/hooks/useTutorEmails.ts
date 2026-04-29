import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TutorEmail {
  id: string;
  tutor_external_id: string;
  tutor_name: string;
  email: string;
  status: "active" | "inactive";
  notes: string | null;
  team_leader: string | null;
  created_at: string;
  updated_at: string;
}

export function useTutorEmails() {
  const [emails, setEmails] = useState<TutorEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("tutor_emails")
      .select("*")
      .order("tutor_name");
    if (data) setEmails(data as TutorEmail[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const channel = supabase
      .channel("tutor_emails_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tutor_emails" }, () => fetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetch]);

  return { emails, isLoading, refetch: fetch };
}

export function useTutorEmailFor(tutorExternalId: string | null | undefined) {
  const [record, setRecord] = useState<TutorEmail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!tutorExternalId) {
      setRecord(null);
      return;
    }
    setIsLoading(true);
    supabase
      .from("tutor_emails")
      .select("*")
      .eq("tutor_external_id", tutorExternalId)
      .maybeSingle()
      .then(({ data }) => {
        setRecord((data as TutorEmail | null) ?? null);
        setIsLoading(false);
      });
  }, [tutorExternalId]);

  return { record, isLoading };
}
