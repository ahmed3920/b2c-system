import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, AlertTriangle, History } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTutorEmailFor } from "@/hooks/useTutorEmails";
import { SendActionPlanEmailDialog } from "./SendActionPlanEmailDialog";
import type { ActionPlan } from "@/hooks/useActionPlans";

interface Props {
  plan: ActionPlan;
}

interface LogEntry {
  id: string;
  subject: string;
  recipient_email: string;
  sent_at: string;
  sent_by_name: string | null;
}

export function PlanCommunicationSection({ plan }: Props) {
  const { record, isLoading } = useTutorEmailFor(plan.tutor_external_id);
  const [sendOpen, setSendOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!plan.id) return;
    supabase
      .from("email_logs")
      .select("id,subject,recipient_email,sent_at,sent_by_name")
      .eq("related_plan_id", plan.id)
      .order("sent_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setLogs((data as LogEntry[]) ?? []));
  }, [plan.id, sendOpen]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Communication</span>
          </div>
          <Button size="sm" onClick={() => setSendOpen(true)}>
            <Send className="w-3 h-3 mr-1" /> Generate &amp; Send Email
          </Button>
        </div>

        <div className="text-sm">
          <span className="text-muted-foreground">Tutor email: </span>
          {isLoading ? (
            <span className="text-muted-foreground">Loading...</span>
          ) : record ? (
            <>
              <a href={`mailto:${record.email}`} className="text-primary hover:underline">{record.email}</a>
              {record.status === "active" ? (
                <Badge className="ml-2 bg-green-500/15 text-green-700 hover:bg-green-500/20 border-green-500/30">Active</Badge>
              ) : (
                <Badge variant="outline" className="ml-2 bg-muted text-muted-foreground">Inactive</Badge>
              )}
            </>
          ) : (
            <span className="inline-flex items-center gap-1 text-destructive">
              <AlertTriangle className="w-3 h-3" /> No active email found for this tutor
            </span>
          )}
        </div>

        {logs.length > 0 && (
          <div className="border-t pt-2">
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
              <History className="w-3 h-3" /> Recent emails
            </div>
            <ul className="space-y-1 text-xs">
              {logs.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="truncate">{l.subject}</span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {format(new Date(l.sent_at), "MMM d, HH:mm")}
                    {l.sent_by_name ? ` · ${l.sent_by_name}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <SendActionPlanEmailDialog open={sendOpen} onOpenChange={setSendOpen} plan={plan} />
    </Card>
  );
}
