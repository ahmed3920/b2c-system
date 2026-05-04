import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCmsAttendance } from "@/hooks/useCmsAttendance";
import { getCheckinWindow, nowInCairo } from "@/hooks/useTodayAttendance";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function CmsCheckinCard() {
  const { row, loading, submitting, checkIn, updateReason } = useCmsAttendance();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editing, setEditing] = useState(false);
  const win = getCheckinWindow(nowInCairo());

  if (loading) {
    return (
      <Card><CardContent className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></CardContent></Card>
    );
  }

  const checkedIn = !!row?.check_in_time;

  const handleCheckIn = async () => {
    if (win === "late" && !reason.trim()) {
      toast({ title: "Reason required", description: "Please add a reason for late check-in.", variant: "destructive" });
      return;
    }
    const res = await checkIn(reason);
    if (!res.ok) toast({ title: "Check-in failed", description: res.error, variant: "destructive" });
    else toast({ title: "Checked in", description: res.row?.status === "on_time" ? "On time ✓" : "Marked as late" });
  };

  const handleSaveReason = async () => {
    const res = await updateReason(editReason);
    if (!res.ok) toast({ title: "Failed", description: res.error, variant: "destructive" });
    else { toast({ title: "Updated" }); setEditing(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Today's Check-in</span>
          {checkedIn && (
            <Badge variant={row!.status === "on_time" ? "default" : row!.status === "late" ? "secondary" : "destructive"}>
              {row!.status === "on_time" ? "On time" : row!.status === "late" ? `Late · ${row!.minutes_late}m` : "Absent"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!checkedIn ? (
          <>
            {win === "before" && <p className="text-sm text-muted-foreground">Check-in opens at 9:30 AM (Cairo).</p>}
            {win !== "before" && (
              <>
                {win === "late" && (
                  <Input
                    placeholder="Reason for being late"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                )}
                <Button onClick={handleCheckIn} disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {win === "open" ? "Check in (On time)" : "Check in (Late)"}
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Checked in at {new Date(row!.check_in_time!).toLocaleTimeString()}
            </p>
            {row!.status === "late" && (
              editing ? (
                <div className="space-y-2">
                  <Input value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Reason" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveReason} disabled={submitting}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm"><span className="text-muted-foreground">Reason:</span> {row!.late_reason || "—"}</p>
                  <Button size="sm" variant="outline" onClick={() => { setEditReason(row!.late_reason ?? ""); setEditing(true); }}>
                    Edit reason
                  </Button>
                </div>
              )
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
