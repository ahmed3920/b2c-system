import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { TutorEmail } from "@/hooks/useTutorEmails";
import { useActionPlanTutors } from "@/hooks/useActionPlans";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  record: TutorEmail | null; // null => create mode
  onSaved: () => void;
}

export function TutorEmailDialog({ open, onOpenChange, record, onSaved }: Props) {
  const { tutors } = useActionPlanTutors();
  const [tutorExternalId, setTutorExternalId] = useState("");
  const [tutorName, setTutorName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [notes, setNotes] = useState("");
  const [teamLeader, setTeamLeader] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (record) {
      setTutorExternalId(record.tutor_external_id);
      setTutorName(record.tutor_name);
      setEmail(record.email);
      setStatus(record.status);
      setNotes(record.notes ?? "");
      setTeamLeader(record.team_leader ?? "");
    } else {
      setTutorExternalId("");
      setTutorName("");
      setEmail("");
      setStatus("active");
      setNotes("");
      setTeamLeader("");
    }
  }, [record, open]);

  const handleTutorPick = (id: string) => {
    setTutorExternalId(id);
    const t = tutors.find((x) => x.tutor_external_id === id);
    if (t) {
      setTutorName(t.tutor_name);
      setTeamLeader(t.team_leader);
    }
  };

  const handleSave = async () => {
    if (!tutorExternalId.trim() || !tutorName.trim() || !email.trim()) {
      toast.error("Tutor ID, name and email are required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Invalid email address");
      return;
    }
    setSaving(true);
    const payload = {
      tutor_external_id: tutorExternalId.trim(),
      tutor_name: tutorName.trim(),
      email: email.trim(),
      status,
      notes: notes.trim() || null,
      team_leader: teamLeader.trim() || null,
    };
    const { error } = record
      ? await supabase.from("tutor_emails").update(payload).eq("id", record.id)
      : await supabase.from("tutor_emails").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    toast.success(record ? "Email updated" : "Email added");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? "Edit Tutor Email" : "Add Tutor Email"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!record && (
            <div>
              <Label>Pick from tutors directory (optional)</Label>
              <Select value={tutorExternalId || undefined} onValueChange={handleTutorPick}>
                <SelectTrigger><SelectValue placeholder="Select tutor..." /></SelectTrigger>
                <SelectContent>
                  {tutors.filter((t) => !!t.tutor_external_id).map((t) => (
                    <SelectItem key={t.id} value={t.tutor_external_id!}>
                      {t.tutor_name} ({t.tutor_external_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Tutor ID *</Label>
            <Input value={tutorExternalId} onChange={(e) => setTutorExternalId(e.target.value)} disabled={!!record} />
          </div>
          <div>
            <Label>Tutor Name *</Label>
            <Input value={tutorName} onChange={(e) => setTutorName(e.target.value)} />
          </div>
          <div>
            <Label>Email Address *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Team Leader</Label>
            <Input value={teamLeader} onChange={(e) => setTeamLeader(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
