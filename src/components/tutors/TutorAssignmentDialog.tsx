import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil } from "lucide-react";
import type { MergedTutor } from "@/hooks/useTutorRoster";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tutor: MergedTutor | null;
  onSubmit: (input: { team_leader: string; mentor: string }) => Promise<{ success: boolean }>;
}

export function TutorAssignmentDialog({ open, onOpenChange, tutor, onSubmit }: Props) {
  const [tl, setTl] = useState("");
  const [mentor, setMentor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && tutor) {
      setTl(tutor.team_leader ?? "");
      setMentor(tutor.mentor ?? "");
    }
  }, [open, tutor]);

  if (!tutor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await onSubmit({ team_leader: tl.trim(), mentor: mentor.trim() });
    setSubmitting(false);
    if (res.success) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" /> Edit Assignment
          </DialogTitle>
          <DialogDescription>
            {tutor.name} <span className="font-mono text-xs">({tutor.id})</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tl">Team Leader</Label>
            <Input id="tl" value={tl} onChange={(e) => setTl(e.target.value)} placeholder="Team leader full name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mentor">Mentor</Label>
            <Input id="mentor" value={mentor} onChange={(e) => setMentor(e.target.value)} placeholder="Mentor full name" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
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
