import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onAdded?: () => void;
}

/**
 * Manual monthly quality entry. Stores one row per tutor per month
 * in `quality_uploads` with session_date = first day of the selected month.
 */
export const ManualQualityEntry = ({ onAdded }: Props) => {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState<string>(defaultMonth);
  const [tutorId, setTutorId] = useState("");
  const [tutorName, setTutorName] = useState("");
  const [teamLeader, setTeamLeader] = useState("");
  const [score, setScore] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const reset = () => { setTutorId(""); setTutorName(""); setTeamLeader(""); setScore(""); };

  const handleSave = async () => {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      toast({ title: "Invalid month", description: "Pick a valid month.", variant: "destructive" });
      return;
    }
    const id = tutorId.trim();
    const name = tutorName.trim();
    const tl = teamLeader.trim();
    const num = parseFloat(score.replace("%", "").trim());
    if (!id || !tl || Number.isNaN(num)) {
      toast({ title: "Missing data", description: "Tutor ID, Team Leader and Score are required.", variant: "destructive" });
      return;
    }
    if (num < 0 || num > 100) {
      toast({ title: "Invalid score", description: "Score must be between 0 and 100.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");
      const sessionDate = `${month}-01`;

      // Replace any existing manual/monthly entry for this tutor+uploader+month.
      const monthStart = `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      const nextMonth = new Date(y, m, 1); // month is 1-based → this is first day of NEXT month
      const nextMonthISO = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

      await supabase
        .from("quality_uploads")
        .delete()
        .eq("uploaded_by", user.id)
        .eq("tutor_id", id)
        .gte("session_date", monthStart)
        .lt("session_date", nextMonthISO);

      const { error } = await supabase.from("quality_uploads").insert({
        tutor_id: id,
        agent_name: name || id,
        team_leader: tl,
        session_date: sessionDate,
        score: num,
        uploaded_by: user.id,
        scope: "team",
      });
      if (error) throw error;

      toast({ title: "Quality saved", description: `${name || id} · ${month} · ${num}%` });
      reset();
      onAdded?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <UserPlus className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold">Add Monthly Quality (Manual)</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Enter a single tutor's quality score for a specific month. Overwrites any prior manual
            entry from you for the same tutor and month.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tutor ID *</Label>
              <Input value={tutorId} onChange={(e) => setTutorId(e.target.value)} placeholder="e.g. T-1234" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tutor Name</Label>
              <Input value={tutorName} onChange={(e) => setTutorName(e.target.value)} placeholder="optional" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Team Leader *</Label>
              <Input value={teamLeader} onChange={(e) => setTeamLeader(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Score % *</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="0 - 100"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Save quality
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
