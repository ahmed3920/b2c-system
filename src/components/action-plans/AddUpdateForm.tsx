import { useEffect, useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, MessageSquarePlus, Mail, CalendarClock, FileText,
  ImagePlus, X, MessageSquare, Sparkles, Send, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { STATUS_LABELS, CATEGORY_LABELS, type ActionPlanStatus, type ActionPlanCategory, type ActionPlan } from "@/hooks/useActionPlans";
import { CATEGORY_FIRST_STEP, type FirstStepKind } from "./categoryFirstStep";
import { useTutorEmailFor } from "@/hooks/useTutorEmails";
import { useTeamLeaderEmailFor } from "@/hooks/useTeamLeaderEmails";
import { useEmailTemplates, fillTemplate } from "@/hooks/useEmailTemplates";
import { useDefaultEmailCc, mergeCcList } from "@/hooks/useDefaultEmailCc";
import { DefaultCcManager } from "@/components/tutor-emails/DefaultCcManager";

type TemplateKey = "free" | "warning_email" | "schedule_meeting" | "meeting_followup";

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  free: "Free note",
  warning_email: "Warning email sent",
  schedule_meeting: "Schedule evaluation meeting",
  meeting_followup: "Meeting follow-up (notes + recording)",
};

const TEMPLATE_ICONS: Record<TemplateKey, React.ElementType> = {
  free: MessageSquare,
  warning_email: Mail,
  schedule_meeting: CalendarClock,
  meeting_followup: FileText,
};

const FIRST_STEP_TO_TEMPLATE: Record<FirstStepKind, TemplateKey> = {
  warning_email: "warning_email",
  schedule_meeting: "schedule_meeting",
  meeting_followup: "meeting_followup",
};

interface Props {
  planId: string;
  category: ActionPlanCategory;
  currentStatus: ActionPlanStatus;
  currentProgress: number;
  firstStepDone: boolean;
  onPosted: (planUpdates: Partial<{ status: ActionPlanStatus; progress: number; resolved_at: string }>) => void;
  /** Full plan, used by the warning email composer for tutor lookup, template vars, and Reply-To. */
  plan: ActionPlan;
}

const STATUS_PROGRESS: Record<ActionPlanStatus, number> = {
  active: 25,
  on_hold: 25,
  escalated: 60,
  resolved: 100,
};

export function AddUpdateForm({
  planId, category, currentStatus, currentProgress, firstStepDone, onPosted, plan,
}: Props) {
  const firstStepSpec = CATEGORY_FIRST_STEP[category];
  const suggestedTemplate: TemplateKey =
    !firstStepDone && firstStepSpec ? FIRST_STEP_TO_TEMPLATE[firstStepSpec.kind] : "free";
  const [template, setTemplate] = useState<TemplateKey>(suggestedTemplate);
  const [posting, setPosting] = useState(false);
  const [statusChange, setStatusChange] = useState<ActionPlanStatus | "none">("none");

  // Free
  const [note, setNote] = useState("");

  // Warning email — now actually sends
  const tutorEmail = useTutorEmailFor(plan.tutor_external_id).record;
  const tlEmail = useTeamLeaderEmailFor(plan.team_leader);
  const { templates } = useEmailTemplates();
  const { list: defaultCcList } = useDefaultEmailCc();
  const [emailTemplateId, setEmailTemplateId] = useState<string>("none");
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailDate, setEmailDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill recipient from tutor email row
  useEffect(() => {
    if (tutorEmail && !emailTo) setEmailTo(tutorEmail.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorEmail?.email]);

  const categoryTemplates = useMemo(
    () => templates.filter((t) =>
      t.is_active && (t.action_plan_category === plan.category || t.action_plan_category === null),
    ),
    [templates, plan.category],
  );

  const templateVars = useMemo(() => ({
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

  const applyEmailTemplate = (id: string) => {
    setEmailTemplateId(id);
    if (id === "none") return;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    const filled = fillTemplate(tpl, templateVars);
    setEmailSubject(filled.subject);
    setEmailBody(filled.body);
  };

  // Schedule meeting
  const [meetingDate, setMeetingDate] = useState<string>("");
  const [meetingTime, setMeetingTime] = useState<string>("");
  const [meetingTopic, setMeetingTopic] = useState("");

  // Meeting follow-up
  const [meetingNotes, setMeetingNotes] = useState("");
  const [recordingLink, setRecordingLink] = useState("");

  const reset = () => {
    setNote("");
    setEmailTemplateId("none");
    setEmailTo(tutorEmail?.email ?? "");
    setEmailCc(""); setEmailSubject(""); setEmailBody("");
    setEmailDate(format(new Date(), "yyyy-MM-dd"));
    setScreenshotFile(null); setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setMeetingDate(""); setMeetingTime(""); setMeetingTopic("");
    setMeetingNotes(""); setRecordingLink("");
    setStatusChange("none");
  };

  const onPickScreenshot = (file: File | null) => {
    if (!file) {
      setScreenshotFile(null);
      setScreenshotPreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setScreenshotFile(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const buildNote = async (userId: string): Promise<string | null> => {
    if (template === "free") {
      const t = note.trim();
      if (!t) { toast.error("Please add a note"); return null; }
      return t;
    }

    if (template === "warning_email") {
      if (!emailSubject.trim() || !emailTo.trim()) {
        toast.error("Subject and recipient are required");
        return null;
      }
      let imageUrl: string | null = null;
      if (screenshotFile) {
        const ext = screenshotFile.name.split(".").pop() || "png";
        const path = `${userId}/${planId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("action-plan-attachments")
          .upload(path, screenshotFile, { contentType: screenshotFile.type });
        if (upErr) {
          toast.error("Failed to upload screenshot", { description: upErr.message });
          return null;
        }
        const { data: pub } = supabase.storage.from("action-plan-attachments").getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }
      const lines = [
        "📧 **Warning Email Sent**",
        `**Subject:** ${emailSubject.trim()}`,
        `**To:** ${emailTo.trim()}`,
      ];
      if (emailCc.trim()) lines.push(`**CC:** ${emailCc.trim()}`);
      lines.push(`**Date:** ${emailDate}`);
      if (tlEmail?.email) lines.push(`**Reply-To:** ${tlEmail.email}`);
      if (emailBody.trim()) lines.push("", emailBody.trim());
      if (imageUrl) lines.push("", `![Email screenshot](${imageUrl})`);
      return lines.join("\n");
    }

    if (template === "schedule_meeting") {
      if (!meetingDate || !meetingTime) {
        toast.error("Meeting date and time are required");
        return null;
      }
      const lines = [
        "📅 **Evaluation Meeting Scheduled**",
        `**When:** ${meetingDate} at ${meetingTime}`,
      ];
      if (meetingTopic.trim()) lines.push(`**Topic:** ${meetingTopic.trim()}`);
      if (note.trim()) lines.push("", note.trim());
      return lines.join("\n");
    }

    if (template === "meeting_followup") {
      if (!meetingNotes.trim()) {
        toast.error("Meeting notes are required");
        return null;
      }
      const lines = [
        "📝 **Meeting Follow-up**",
        "**Notes:**",
        meetingNotes.trim(),
      ];
      if (recordingLink.trim()) lines.push("", `**Recording:** ${recordingLink.trim()}`);
      return lines.join("\n");
    }
    return null;
  };

  const post = async () => {
    setPosting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setPosting(false); return; }

    // For warning_email, open the user's mail client (sends from THEIR address) and log it
    if (template === "warning_email") {
      if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) {
        toast.error("Recipient, subject and body are required");
        setPosting(false);
        return;
      }
      const params = new URLSearchParams();
      if (emailCc.trim()) params.set("cc", emailCc.trim());
      params.set("subject", emailSubject.trim());
      params.set("body", emailBody.trim());
      const mailto = `mailto:${encodeURIComponent(emailTo.trim())}?${params.toString().replace(/\+/g, "%20")}`;

      const { data: profileForLog } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", session.user.id)
        .maybeSingle();

      await supabase.from("email_logs").insert({
        tutor_external_id: plan.tutor_external_id,
        tutor_name: plan.tutor_name,
        recipient_email: emailTo.trim(),
        cc_emails: emailCc.trim() || null,
        subject: emailSubject.trim(),
        body: emailBody.trim(),
        status: "sent",
        related_plan_id: planId,
        template_id: emailTemplateId === "none" ? null : emailTemplateId,
        sent_by: session.user.id,
        sent_by_name: profileForLog?.full_name ?? null,
        reply_to: tlEmail?.email ?? null,
        from_email: null,
      });

      window.open(mailto, "_self");
      toast.success("Email opened in your mail client", {
        description: "Send it from there — it will come from your own address. The communication has been logged.",
      });
    }

    const composedNote = await buildNote(session.user.id);
    if (!composedNote) { setPosting(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, mentor_name")
      .eq("user_id", session.user.id)
      .single();

    const newStatus = statusChange !== "none" ? statusChange : null;
    let autoProgress: number | null = null;
    if (newStatus) autoProgress = STATUS_PROGRESS[newStatus];
    else if (currentStatus !== "resolved") autoProgress = Math.min(90, currentProgress + 10);

    const { error: stepErr } = await supabase.from("action_plan_steps").insert({
      plan_id: planId,
      author_id: session.user.id,
      author_name: profile?.full_name || profile?.mentor_name || "User",
      note: composedNote,
      status_change: newStatus,
      progress_change: autoProgress,
    });
    if (stepErr) {
      toast.error("Failed to post update", { description: stepErr.message });
      setPosting(false);
      return;
    }

    const planUpdates: Partial<{ status: ActionPlanStatus; progress: number; resolved_at: string }> = {};
    if (newStatus) {
      planUpdates.status = newStatus;
      if (newStatus === "resolved") planUpdates.resolved_at = new Date().toISOString();
    }
    if (autoProgress !== null) planUpdates.progress = autoProgress;

    if (Object.keys(planUpdates).length > 0) {
      const { error: planErr } = await supabase.from("action_plans").update(planUpdates).eq("id", planId);
      if (planErr) {
        toast.error("Update saved but plan change failed", { description: planErr.message });
      }
    }

    toast.success("Update posted");
    reset();
    setPosting(false);
    onPosted(planUpdates);
  };

  const Icon = TEMPLATE_ICONS[template];

  return (
    <div className="space-y-3 border rounded-md p-3 bg-muted/20">
      <Label className="text-sm font-semibold flex items-center gap-2">
        <MessageSquarePlus className="w-4 h-4" /> Add Update
      </Label>

      {!firstStepDone && firstStepSpec && (
        <div className="flex items-start gap-2 text-xs rounded-md border border-orange-500/30 bg-orange-500/5 p-2">
          <Sparkles className="w-3.5 h-3.5 text-orange-600 mt-0.5 shrink-0" />
          <span>
            Suggested first step for this category:{" "}
            <strong>{firstStepSpec.label}</strong>
          </span>
        </div>
      )}

      <div>
        <Label className="text-xs">Template</Label>
        <Select value={template} onValueChange={(v) => setTemplate(v as TemplateKey)}>
          <SelectTrigger>
            <SelectValue>
              <span className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {TEMPLATE_LABELS[template]}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map((k) => {
              const I = TEMPLATE_ICONS[k];
              return (
                <SelectItem key={k} value={k}>
                  <span className="flex items-center gap-2">
                    <I className="w-4 h-4" /> {TEMPLATE_LABELS[k]}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {template === "free" && (
        <Textarea
          placeholder="What happened? What's next?"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}

      {template === "warning_email" && (
        <div className="space-y-2 rounded-md border bg-background p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <Mail className="w-3.5 h-3.5" /> Compose &amp; send warning email
          </div>

          {!tutorEmail && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-xs">
                No email saved for this tutor. Add one in the <strong>Tutor Emails</strong> tab,
                or enter the recipient manually.
              </AlertDescription>
            </Alert>
          )}
          {tutorEmail?.status === "inactive" && (
            <Alert className="py-2 border-yellow-500/40 bg-yellow-500/10">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <AlertDescription className="text-xs">
                Tutor's email is marked <strong>Inactive</strong>.
              </AlertDescription>
            </Alert>
          )}
          {!tlEmail?.email && (
            <Alert className="py-2 border-yellow-500/40 bg-yellow-500/10">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <AlertDescription className="text-xs">
                No email mapped for Team Leader <strong>{plan.team_leader}</strong> — replies will
                not route to them. Admin can add it in <strong>Team Leader Emails</strong>.
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Label className="text-xs">Generate from template</Label>
            <Select value={emailTemplateId} onValueChange={applyEmailTemplate}>
              <SelectTrigger><SelectValue placeholder="Pick a template..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template (write manually)</SelectItem>
                {categoryTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">To *</Label>
              <Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="tutor@example.com" />
            </div>
            <div>
              <Label className="text-xs">CC (comma-separated)</Label>
              <Input value={emailCc} onChange={(e) => setEmailCc(e.target.value)} placeholder="manager@example.com" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Subject *</Label>
            <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Warning - 2nd Emergency Request" />
          </div>

          <div>
            <Label className="text-xs">Body *</Label>
            <Textarea rows={6} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={emailDate} onChange={(e) => setEmailDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Reply-To</Label>
              <Input value={tlEmail?.email ?? ""} readOnly className="bg-muted/50 text-muted-foreground" placeholder="(no TL email mapped)" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Optional screenshot of the sent email</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickScreenshot(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="w-4 h-4 mr-1" />
                {screenshotFile ? "Change image" : "Attach screenshot"}
              </Button>
              {screenshotFile && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onPickScreenshot(null)}>
                  <X className="w-4 h-4 mr-1" /> Remove
                </Button>
              )}
            </div>
            {screenshotPreview && (
              <img src={screenshotPreview} alt="Screenshot preview" className="mt-2 max-h-48 rounded border" />
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Sent from the system's verified domain with <strong>Reply-To = Team Leader</strong>,
            so tutor replies go straight to {tlEmail?.email || plan.team_leader}.
          </p>
        </div>
      )}

      {template === "schedule_meeting" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Meeting date *</Label>
              <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Meeting time *</Label>
              <Input type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Topic / agenda</Label>
            <Input value={meetingTopic} onChange={(e) => setMeetingTopic(e.target.value)} placeholder="Quality evaluation meeting" />
          </div>
          <Textarea placeholder="Additional details (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}

      {template === "meeting_followup" && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Meeting notes *</Label>
            <Textarea rows={4} value={meetingNotes} onChange={(e) => setMeetingNotes(e.target.value)} placeholder="Key points discussed, agreements, action items..." />
          </div>
          <div>
            <Label className="text-xs">Recording link</Label>
            <Input type="url" value={recordingLink} onChange={(e) => setRecordingLink(e.target.value)} placeholder="https://drive.google.com/..." />
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs">Change status (optional)</Label>
        <Select value={statusChange} onValueChange={(v) => setStatusChange(v as ActionPlanStatus | "none")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No change</SelectItem>
            {(Object.keys(STATUS_LABELS) as ActionPlanStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Progress is updated automatically based on status and posted updates.
        </p>
      </div>

      <Button onClick={post} disabled={posting} size="sm">
        {posting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {template === "warning_email" ? <><Send className="w-4 h-4 mr-2" /> Send email &amp; post update</> : "Post Update"}
      </Button>
    </div>
  );
}
