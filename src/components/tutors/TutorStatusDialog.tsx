import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserX } from "lucide-react";
import type { TutorStatusValue, UpsertTutorStatusInput, TutorStatusRecord } from "@/hooks/useTutorStatus";

interface TutorStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tutor: {
    id: string;
    name: string;
    team_leader?: string | null;
    is_mentor?: boolean;
  } | null;
  current?: TutorStatusRecord | null;
  onSubmit: (input: UpsertTutorStatusInput) => Promise<{ success: boolean }>;
}

export function TutorStatusDialog({ open, onOpenChange, tutor, current, onSubmit }: TutorStatusDialogProps) {
  const [status, setStatus] = useState<TutorStatusValue>("active");
  const [date, setDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus(current?.status ?? "resigned");
      setDate(current?.effective_date ?? new Date().toISOString().slice(0, 10));
      setNotes(current?.notes ?? "");
    }
  }, [open, current]);

  if (!tutor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await onSubmit({
      tutor_external_id: tutor.id,
      tutor_name: tutor.name,
      team_leader: tutor.team_leader ?? null,
      is_mentor: tutor.is_mentor ?? false,
      status,
      effective_date: status === "active" ? null : date || null,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (res.success) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5" />
            Update Tutor Status
          </DialogTitle>
          <DialogDescription>
            {tutor.name} <span className="font-mono text-xs">({tutor.id})</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v: TutorStatusValue) => setStatus(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="resigned">Resigned</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status !== "active" && (
            <div className="space-y-2">
              <Label htmlFor="effective_date">Effective Date</Label>
              <Input
                id="effective_date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason or context…"
              rows={3}
            />
          </div>

          {current && (
            <p className="text-xs text-muted-foreground">
              Last set by {current.set_by_name ?? "—"} on{" "}
              {new Date(current.updated_at).toLocaleDateString()}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
