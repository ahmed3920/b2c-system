import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Status = "on_time" | "late" | "absent";

export interface CmsEditableRow {
  id: string;
  user_id: string;
  user_name: string | null;
  date: string;
  check_in_time: string | null;
  status: Status;
  minutes_late: number;
  late_reason: string | null;
}

interface Props {
  row: CmsEditableRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function CmsAdminEditAttendanceDialog({ row, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("on_time");
  const [minutesLate, setMinutesLate] = useState<number>(0);
  const [lateReason, setLateReason] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    if (status !== "absent" && !row.check_in_time) {
      payload.check_in_time = new Date().toISOString();
    }
    const { error } = await supabase.from("cms_attendance").update(payload).eq("id", row.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Attendance updated" });
    onOpenChange(false);
    onSaved();
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("cms_attendance").delete().eq("id", row.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Attendance deleted" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
            <DialogDescription>
              {row.user_name ?? row.user_id.slice(0, 8)} · {row.date}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                placeholder="Optional admin note"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between gap-2">
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={saving || deleting}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attendance record?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the record for {row.user_name ?? "this user"} on {row.date}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
