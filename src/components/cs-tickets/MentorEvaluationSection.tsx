import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Paperclip, Plus, Trash2, UserCheck, ExternalLink, Link2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import type { CSTicket, SessionRecording } from "./useCSTickets";

interface MentorOption {
  user_id: string;
  full_name: string | null;
  mentor_name: string | null;
  team_leader: string | null;
}

interface Props {
  ticket: CSTicket;
  onChanged?: () => void;
}

export function MentorEvaluationSection({ ticket, onChanged }: Props) {
  const { isAdmin, isTeamLeader, isSuperTeamLeader, isMentor } = useUserRole();
  const canAssign = isAdmin || isTeamLeader || isSuperTeamLeader;
  const isAssignedMentor = isMentor && !canAssign; // mentor-only view of the section

  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [selectedMentor, setSelectedMentor] = useState<string>(ticket.assigned_mentor_id ?? "");
  const [recordings, setRecordings] = useState<SessionRecording[]>(ticket.session_recordings ?? []);
  const [linkInput, setLinkInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [evalNotes, setEvalNotes] = useState(ticket.mentor_evaluation_notes ?? "");
  const [recommendation, setRecommendation] = useState(ticket.mentor_recommendation ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedMentor(ticket.assigned_mentor_id ?? "");
    setRecordings(ticket.session_recordings ?? []);
    setEvalNotes(ticket.mentor_evaluation_notes ?? "");
    setRecommendation(ticket.mentor_recommendation ?? "");
  }, [ticket.id]);

  useEffect(() => {
    if (!canAssign) return;
    supabase.rpc("list_available_mentors").then(({ data }) => {
      if (data) setMentors(data as MentorOption[]);
    });
  }, [canAssign]);

  const mentorMap = useMemo(() => {
    const m = new Map<string, MentorOption>();
    mentors.forEach((x) => m.set(x.user_id, x));
    return m;
  }, [mentors]);

  const handleAddLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: "Invalid link", description: "Must start with http(s)://", variant: "destructive" });
      return;
    }
    setRecordings((r) => [...r, { kind: "link", url, added_at: new Date().toISOString() }]);
    setLinkInput("");
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newRecs: SessionRecording[] = [];
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${ticket.id}/${Date.now()}_${safe}`;
        const { error } = await supabase.storage.from("cs-recordings").upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        });
        if (error) throw error;
        newRecs.push({ kind: "file", url: path, path, label: file.name, added_at: new Date().toISOString() });
      }
      setRecordings((r) => [...r, ...newRecs]);
      toast({ title: `Uploaded ${newRecs.length} file(s)` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveRecording = async (idx: number) => {
    const rec = recordings[idx];
    if (rec.kind === "file" && rec.path) {
      await supabase.storage.from("cs-recordings").remove([rec.path]);
    }
    setRecordings((r) => r.filter((_, i) => i !== idx));
  };

  const handleSaveAssignment = async () => {
    if (!selectedMentor) {
      toast({ title: "Select a mentor", variant: "destructive" });
      return;
    }
    if (recordings.length === 0) {
      toast({
        title: "Recording required",
        description: "Upload at least one recording or add a link before assigning a mentor.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const m = mentorMap.get(selectedMentor);
      const { data: sess } = await supabase.auth.getSession();
      const payload: any = {
        assigned_mentor_id: selectedMentor,
        assigned_mentor_name: m?.full_name || m?.mentor_name || null,
        mentor_assigned_at: new Date().toISOString(),
        mentor_assigned_by: sess.session?.user.id ?? null,
        session_recordings: recordings as any,
      };
      const { error } = await supabase.from("cs_tickets").update(payload).eq("id", ticket.id);
      if (error) throw error;
      toast({ title: "Mentor assigned" });
      onChanged?.();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRecordingsOnly = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("cs_tickets")
        .update({ session_recordings: recordings as any })
        .eq("id", ticket.id);
      if (error) throw error;
      toast({ title: "Recordings saved" });
      onChanged?.();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEvaluation = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("cs_tickets")
        .update({
          mentor_evaluation_notes: evalNotes || null,
          mentor_recommendation: recommendation || null,
        })
        .eq("id", ticket.id);
      if (error) throw error;
      toast({ title: "Evaluation saved" });
      onChanged?.();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openRecording = async (rec: SessionRecording) => {
    if (rec.kind === "link") {
      window.open(rec.url, "_blank", "noopener");
      return;
    }
    if (!rec.path) return;
    const { data, error } = await supabase.storage
      .from("cs-recordings")
      .createSignedUrl(rec.path, 60 * 60);
    if (error || !data) {
      toast({ title: "Cannot open file", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const RecordingsList = (
    <div className="space-y-2">
      {recordings.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recordings yet.</p>
      ) : (
        recordings.map((rec, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              {rec.kind === "link" ? (
                <Link2 className="h-4 w-4 shrink-0" />
              ) : (
                <Paperclip className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate" title={rec.label || rec.url}>
                {rec.label || rec.url}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={() => openRecording(rec)} title="Open">
                {rec.kind === "link" ? <ExternalLink className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              </Button>
              {(canAssign || isAdmin) && !isAssignedMentor && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleRemoveRecording(idx)}
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ---------- MENTOR VIEW ----------
  if (isAssignedMentor) {
    return (
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Mentor Evaluation</h3>
          <Badge variant="secondary">
            <UserCheck className="mr-1 h-3 w-3" /> Assigned to you
          </Badge>
        </div>

        <div className="space-y-2">
          <Label>Session Recordings</Label>
          {RecordingsList}
        </div>

        <div className="space-y-2">
          <Label>Evaluation Notes</Label>
          <Textarea
            rows={4}
            value={evalNotes}
            onChange={(e) => setEvalNotes(e.target.value)}
            placeholder="Document your review of the session..."
          />
        </div>
        <div className="space-y-2">
          <Label>Recommendation</Label>
          <Textarea
            rows={3}
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            placeholder="Action items / coaching recommendation..."
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSaveEvaluation} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Evaluation"}
          </Button>
        </div>
      </div>
    );
  }

  // ---------- TL / ADMIN VIEW ----------
  if (!canAssign) return null;

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Mentor Evaluation</h3>
        {ticket.assigned_mentor_id && (
          <Badge variant="default">
            <UserCheck className="mr-1 h-3 w-3" /> {ticket.assigned_mentor_name || "Assigned"}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Assigned Mentor *</Label>
          <Select value={selectedMentor} onValueChange={setSelectedMentor}>
            <SelectTrigger>
              <SelectValue placeholder="Select a mentor" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {mentors.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground">No mentors available.</div>
              ) : (
                mentors.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    <div className="flex flex-col">
                      <span>{m.full_name || m.mentor_name}</span>
                      {m.team_leader && (
                        <span className="text-xs text-muted-foreground">{m.team_leader}</span>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Session Recordings *</Label>
        <p className="text-xs text-muted-foreground">
          At least one recording (file or link) is required to assign a mentor.
        </p>
        {RecordingsList}

        <div className="flex flex-wrap gap-2 pt-2">
          <Input
            placeholder="https://drive.google.com/..."
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Button type="button" variant="outline" onClick={handleAddLink}>
            <Plus className="mr-2 h-4 w-4" /> Add Link
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUploadFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
            Upload Files
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {ticket.assigned_mentor_id && (
          <Button variant="outline" onClick={handleSaveRecordingsOnly} disabled={saving}>
            Save Recordings
          </Button>
        )}
        <Button onClick={handleSaveAssignment} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : ticket.assigned_mentor_id ? "Reassign Mentor" : "Assign Mentor"}
        </Button>
      </div>

      {(ticket.mentor_evaluation_notes || ticket.mentor_recommendation) && (
        <div className="space-y-3 rounded border bg-muted/30 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mentor Evaluation
          </h4>
          {ticket.mentor_evaluation_notes && (
            <div>
              <p className="text-xs font-medium">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{ticket.mentor_evaluation_notes}</p>
            </div>
          )}
          {ticket.mentor_recommendation && (
            <div>
              <p className="text-xs font-medium">Recommendation</p>
              <p className="text-sm whitespace-pre-wrap">{ticket.mentor_recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
