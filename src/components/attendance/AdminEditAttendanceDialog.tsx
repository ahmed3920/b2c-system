import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Status = "on_time" | "late" | "absent";

export interface EditableRow {
  id: string;
  team_leader_id: string;
  team_leader_name: string | null;
  date: string;
  check_in_time: string | null;
  status: Status;
  minutes_late: number;
  late_reason: string | null;
}

interface Props {
  row: EditableRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function AdminEditAttendanceDialog({ row, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("on_time");
  const [minutesLate, setMinutesLate] = useState<number>(0);
  const [lateReason, setLateReason] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (row) {
      setStatus(row.status);
      setMinutesLate(row.minutes_late ?? 0);
      setLateReason(row.late_reason ?? "");
    }
  }, [row]);

  if (!row) return null;

  const handleSave = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      status,
      minutes_late: status === "late" ? Math.max(0, minutesLate) : 0,
      late_reason: lateReason.trim() || null,
    };
    // If admin changes absent → on_time/late and no check_in_time exists, stamp one (now UTC).
    if (status !== "absent" && !row.check_in_time) {
      payload.check_in_time = new Date().toISOString();
    }
    const { error } = await supabase
      .from("team_leader_attendance")
      .update(payload)
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Attendance updated" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Attendance</DialogTitle>
          <DialogDescription>
            {row.team_leader_name ?? row.team_leader_id.slice(0, 8)} · {row.date}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on_time">On Time</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === "late" && (
            <div>
              <Label htmlFor="mins">Minutes Late</Label>
              <Input
                id="mins"
                type="number"
                min={0}
                value={minutesLate}
                onChange={(e) => setMinutesLate(Number(e.target.value) || 0)}
              />
            </div>
          )}

          <div>
            <Label htmlFor="reason">Reason / Note</Label>
            <Textarea
              id="reason"
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
              placeholder="Optional admin note (e.g. excused, traffic, sick…)"
              rows={3}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Tip: changing status from <strong>Late</strong> to <strong>On Time</strong> clears the
            minutes-late counter automatically.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
