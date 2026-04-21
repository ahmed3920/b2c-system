import { supabase } from "@/integrations/supabase/client";

const TRACKED_FIELDS = [
  "ticket_number",
  "ticket_date",
  "cs_category",
  "edu_category",
  "case_details",
  "student_id",
  "session_num_or_date",
  "need_response_deadline",
  "status",
  "team_leader_response",
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

const norm = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v);
};

export async function logCSTicketChanges(opts: {
  ticketId: string;
  ticketNumber: string;
  before: Record<string, any>;
  after: Record<string, any>;
}) {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    if (!userId) return;

    const { data: prof } = await supabase
      .from("profiles")
      .select("mentor_name, full_name")
      .eq("user_id", userId)
      .maybeSingle();
    const changedByName = prof?.mentor_name ?? prof?.full_name ?? null;

    const rows: any[] = [];
    for (const f of TRACKED_FIELDS as readonly TrackedField[]) {
      const a = norm(opts.before[f]);
      const b = norm(opts.after[f]);
      if (a !== b) {
        rows.push({
          ticket_id: opts.ticketId,
          ticket_number: opts.ticketNumber,
          field_name: f,
          old_value: a || null,
          new_value: b || null,
          changed_by: userId,
          changed_by_name: changedByName,
        });
      }
    }
    if (rows.length === 0) return;
    await supabase.from("cs_ticket_audit").insert(rows);
  } catch {
    // non-blocking
  }
}
