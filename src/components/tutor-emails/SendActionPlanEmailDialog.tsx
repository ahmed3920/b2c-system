import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Send, Loader2, Mail } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTutorEmailFor } from "@/hooks/useTutorEmails";
import { useEmailTemplates, fillTemplate } from "@/hooks/useEmailTemplates";
import { CATEGORY_LABELS, type ActionPlan } from "@/hooks/useActionPlans";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: ActionPlan;
}

export function SendActionPlanEmailDialog({ open, onOpenChange, plan }: Props) {
  const { record: tutorEmail, isLoading: emailLoading } = useTutorEmailFor(plan.tutor_external_id);
  const { templates } = useEmailTemplates();
  const [templateId, setTemplateId] = useState<string>("none");
  const [recipient, setRecipient] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const categoryTemplates = useMemo(
    () => templates.filter((t) => t.is_active && (t.action_plan_category === plan.category || t.action_plan_category === null)),
    [templates, plan.category],
  );

  useEffect(() => {
    if (tutorEmail) setRecipient(tutorEmail.email);
  }, [tutorEmail]);

  const vars = useMemo(() => ({
    tutor_name: plan.tutor_name,
    tutor_id: plan.tutor_external_id ?? "",
    team_leader: plan.team_leader,
    category: CATEGORY_LABELS[plan.category],
    summary: plan.summary ?? "",
    start_date: format(new Date(plan.start_date), "MMM d, yyyy"),
    due_date: format(new Date(plan.due_date), "MMM d, yyyy"),
    status: plan.status,
    progress: String(plan.progress),
    date: format(new Date(), "MMM d, yyyy"),
  }), [plan]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (id === "none") return;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    const filled = fillTemplate(tpl, vars);
    setSubject(filled.subject);
    setBody(filled.body);
  };

  const isInactive = tutorEmail?.status === "inactive";
  const noEmail = !emailLoading && !tutorEmail;

  const handleSend = async () => {
    if (!recipient.trim()) {
      toast.error("Recipient email required");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and body required");
      return;
    }
    setSending(true);

    // Build mailto URL — opens in user's default email client (Gmail/Outlook/etc)
    // so it sends FROM the team leader's own email address.
    const params = new URLSearchParams();
    if (cc.trim()) params.set("cc", cc.trim());
    params.set("subject", subject);
    params.set("body", body);
    const mailto = `mailto:${encodeURIComponent(recipient.trim())}?${params.toString().replace(/\+/g, "%20")}`;

    // Log it
    const { data: { session } } = await supabase.auth.getSession();
    const { data: profile } = session
      ? await supabase.from("profiles").select("full_name").eq("user_id", session.user.id).single()
      : { data: null };

    await supabase.from("email_logs").insert({
      tutor_external_id: plan.tutor_external_id,
      tutor_name: plan.tutor_name,
      recipient_email: recipient.trim(),
      cc_emails: cc.trim() || null,
      subject,
      body,
      status: "sent",
      related_plan_id: plan.id,
      template_id: templateId === "none" ? null : templateId,
      sent_by: session?.user.id,
      sent_by_name: profile?.full_name ?? null,
    });

    window.location.href = mailto;
    setSending(false);
    toast.success("Email opened in your mail client", {
      description: "Send it from there. The communication is logged.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" /> Send Email — {plan.tutor_name}
          </DialogTitle>
        </DialogHeader>

        {noEmail && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              No email found for this tutor. Add one in the <strong>Tutor Emails</strong> tab, or enter the recipient manually below.
            </AlertDescription>
          </Alert>
        )}
        {isInactive && (
          <Alert className="border-yellow-500/40 bg-yellow-500/10">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <AlertDescription>
              This tutor's email is marked <strong>Inactive</strong>. Sending is allowed but discouraged.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div>
            <Label>Generate from Template</Label>
            <Select value={templateId} onValueChange={applyTemplate}>
              <SelectTrigger><SelectValue placeholder="Pick a template..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template (write manually)</SelectItem>
                {categoryTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>To *</Label>
            <Input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </div>
          <div>
            <Label>CC (comma-separated)</Label>
            <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="manager@example.com, hr@example.com" />
          </div>
          <div>
            <Label>Subject *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Body *</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} />
          </div>
          <p className="text-xs text-muted-foreground">
            Email will open in your default mail client (sent from your email address).
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !recipient.trim()}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Open in mail client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
