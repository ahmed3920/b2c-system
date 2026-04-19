import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, MessageSquarePlus, Mail, CalendarClock, FileText,
  ImagePlus, X, MessageSquare, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { STATUS_LABELS, type ActionPlanStatus, type ActionPlanCategory } from "@/hooks/useActionPlans";
import { CATEGORY_FIRST_STEP, type FirstStepKind } from "./categoryFirstStep";

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
}

const STATUS_PROGRESS: Record<ActionPlanStatus, number> = {
  active: 25,
  on_hold: 25,
  escalated: 60,
  resolved: 100,
};

export function AddUpdateForm({ planId, category, currentStatus, currentProgress, firstStepDone, onPosted }: Props) {
  const firstStepSpec = CATEGORY_FIRST_STEP[category];
  const suggestedTemplate: TemplateKey =
    !firstStepDone && firstStepSpec ? FIRST_STEP_TO_TEMPLATE[firstStepSpec.kind] : "free";
  const [template, setTemplate] = useState<TemplateKey>(suggestedTemplate);
  const [posting, setPosting] = useState(false);
  const [statusChange, setStatusChange] = useState<ActionPlanStatus | "none">("none");

  // Free / warning email
  const [note, setNote] = useState("");

  // Warning email specifics
  const [emailSubject, setEmailSubject] = useState("");
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailDate, setEmailDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Schedule meeting
  const [meetingDate, setMeetingDate] = useState<string>("");
  const [meetingTime, setMeetingTime] = useState<string>("");
  const [meetingTopic, setMeetingTopic] = useState("");

  // Meeting follow-up
  const [meetingNotes, setMeetingNotes] = useState("");
  const [recordingLink, setRecordingLink] = useState("");

  const reset = () => {
    setNote("");
    setEmailSubject(""); setEmailRecipient(""); setEmailDate(format(new Date(), "yyyy-MM-dd"));
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
      if (!emailSubject.trim() || !emailRecipient.trim()) {
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
        `**To:** ${emailRecipient.trim()}`,
        `**Date:** ${emailDate}`,
      ];
      if (note.trim()) lines.push("", note.trim());
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

      {/* Template picker */}
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

      {/* Template-specific fields */}
      {template === "free" && (
        <Textarea
          placeholder="What happened? What's next?"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}

      {template === "warning_email" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Subject *</Label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Warning - 2nd Emergency Request"
              />
            </div>
            <div>
              <Label className="text-xs">Recipient *</Label>
              <Input
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="tutor@example.com"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Date sent</Label>
            <Input
              type="date"
              value={emailDate}
              onChange={(e) => setEmailDate(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Screenshot of the sent email</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickScreenshot(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="w-4 h-4 mr-1" />
                {screenshotFile ? "Change image" : "Attach screenshot"}
              </Button>
              {screenshotFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onPickScreenshot(null)}
                >
                  <X className="w-4 h-4 mr-1" /> Remove
                </Button>
              )}
            </div>
            {screenshotPreview && (
              <img
                src={screenshotPreview}
                alt="Screenshot preview"
                className="mt-2 max-h-48 rounded border"
              />
            )}
          </div>
          <Textarea
            placeholder="Additional details (optional)"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
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
            <Input
              value={meetingTopic}
              onChange={(e) => setMeetingTopic(e.target.value)}
              placeholder="Quality evaluation meeting"
            />
          </div>
          <Textarea
            placeholder="Additional details (optional)"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}

      {template === "meeting_followup" && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Meeting notes *</Label>
            <Textarea
              rows={4}
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              placeholder="Key points discussed, agreements, action items..."
            />
          </div>
          <div>
            <Label className="text-xs">Recording link</Label>
            <Input
              type="url"
              value={recordingLink}
              onChange={(e) => setRecordingLink(e.target.value)}
              placeholder="https://drive.google.com/..."
            />
          </div>
        </div>
      )}

      {/* Status change (shared) */}
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
        Post Update
      </Button>
    </div>
  );
}
