import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Clock, CheckCircle2, AlertTriangle, Loader2, Pencil, X, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCmsAttendance } from "@/hooks/useCmsAttendance";
import {
  nowInCairo,
  getCheckinWindow,
  minutesOfDay,
  ON_TIME_END_MIN,
} from "@/hooks/useTodayAttendance";

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Cairo",
  });
}

function statusBadge(status: "on_time" | "late" | "absent") {
  if (status === "on_time")
    return (
      <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/20">
        On Time
      </Badge>
    );
  if (status === "late")
    return (
      <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 hover:bg-red-500/20">
        Late
      </Badge>
    );
  return (
    <Badge variant="secondary" className="bg-muted text-muted-foreground">
      Absent
    </Badge>
  );
}

export function CmsCheckinCard() {
  const { row, loading, submitting, checkIn, updateReason } = useCmsAttendance();
  const { toast } = useToast();
  const [, force] = useState(0);
  const [reason, setReason] = useState("");
  const [editingReason, setEditingReason] = useState(false);
  const [reasonDraft, setReasonDraft] = useState("");

  // Re-render every 30s so the time-window check updates without refresh.
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Today's Check-in
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Already checked in
  if (row && row.check_in_time) {
    const checkInLocal = new Date(row.check_in_time);
    const handleSaveReason = async () => {
      const res = await updateReason(reasonDraft);
      if (!res.ok) {
        toast({ title: "Failed to save", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Reason updated" });
      setEditingReason(false);
    };

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-green-600" /> Today's Check-in
          </CardTitle>
          {statusBadge(row.status)}
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Checked in at{" "}
            <span className="font-medium text-foreground">{formatTime(checkInLocal)}</span>
          </p>
          {row.status === "late" && row.minutes_late > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {row.minutes_late} min late
            </p>
          )}

          {row.status === "late" && !editingReason && (
            <div className="flex items-start justify-between gap-2 rounded-md border bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground italic">
                {row.late_reason ? `"${row.late_reason}"` : "No reason provided"}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={() => {
                  setReasonDraft(row.late_reason ?? "");
                  setEditingReason(true);
                }}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </div>
          )}

          {row.status === "late" && editingReason && (
            <div className="space-y-2">
              <Textarea
                value={reasonDraft}
                onChange={(e) => setReasonDraft(e.target.value)}
                placeholder="Reason for being late"
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveReason} disabled={submitting} className="flex-1">
                  {submitting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-3 w-3 mr-1" /> Save
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingReason(false)}
                  disabled={submitting}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                You can edit this reason until the end of today.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const cairoNow = nowInCairo();
  const window = getCheckinWindow(cairoNow);

  const handleCheckIn = async () => {
    const res = await checkIn(window === "late" ? reason : undefined);
    if (!res.ok) {
      toast({ title: "Check-in failed", description: res.error, variant: "destructive" });
      return;
    }
    toast({
      title: "Checked in",
      description:
        res.row?.status === "late"
          ? `Marked as late (${res.row.minutes_late} min)`
          : "You're on time today 🎉",
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" /> Today's Check-in
        </CardTitle>
        <span className="text-xs text-muted-foreground">{formatTime(cairoNow)}</span>
      </CardHeader>
      <CardContent className="space-y-3">
        {window === "before" && (
          <>
            <p className="text-sm text-muted-foreground">
              Check-in opens at <span className="font-medium text-foreground">9:30 AM</span>
            </p>
            <Button disabled className="w-full">
              Check In
            </Button>
          </>
        )}

        {window === "open" && (
          <>
            <p className="text-sm text-muted-foreground">
              Window: <span className="font-medium text-foreground">9:30 – 10:15 AM</span>
            </p>
            <Button onClick={handleCheckIn} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check In"}
            </Button>
          </>
        )}

        {window === "late" && (
          <>
            <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                You are checking in late ({Math.max(0, minutesOfDay(cairoNow) - ON_TIME_END_MIN)}{" "}
                min after 10:15)
              </span>
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for being late (optional)"
              rows={2}
              className="text-sm"
            />
            <Button
              onClick={handleCheckIn}
              disabled={submitting}
              variant="destructive"
              className="w-full"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check In (Late)"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
