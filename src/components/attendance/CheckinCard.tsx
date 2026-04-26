import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Clock, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useTodayAttendance,
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

export function CheckinCard() {
  const { row, loading, submitting, checkIn } = useTodayAttendance();
  const { toast } = useToast();
  const [, force] = useState(0);
  const [reason, setReason] = useState("");

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
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-green-600" /> Today's Check-in
          </CardTitle>
          {statusBadge(row.status)}
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Checked in at{" "}
            <span className="font-medium text-foreground">{formatTime(checkInLocal)}</span>
          </p>
          {row.status === "late" && row.minutes_late > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {row.minutes_late} min late
              {row.late_reason ? ` · "${row.late_reason}"` : ""}
            </p>
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
